import Face from './b/face';
import hood from './b/hood';

let ref = new Firebase('https://underhood.firebaseio.com/');
let face = new Face();
let d = $(document);

let sortFuncs = {
  favs(a, b) { return b.favs - a.favs },
  rt(a, b) { return b.rt - a.rt },
};

// simple error handler
window.onerror = m => hood.status = 'error';

class Underhood {
  constructor() {
    this.tweetsToLoad = 84;
    this.tweetsPerPage = 24;

    this.setParams();
    this.loadTweets();
    this.initEvents();
  }

  setParams() {
    this.currentEndingTweet = 0;
    this.current = 0;

    this.params = new URI().search(true);
    this.ids = [];

    this.params.sort = this.params.sort || 'favs';
    this.params.from = this.params.from || 'cssunderhood';
    this.params.timeline = this.params.timeline || 'all';

    if (!~['favs', 'rt'].indexOf(this.params.sort))
      throw new Error('Invalid sortby value.');

    let uhs = ['cssunderhood', 'jsunderhood', 'iamspacegray', 'backendsecret'];
    if (!~uhs.indexOf(this.params.from))
      throw new Error('Invalid underhood type.');

    face.syncFormControls(this.params);
  }

  loadTweets() {
    if (!this.params.from)
      throw new Error('Tweets source is not defined.');

    hood.status = 'loading';

    let underhoodRef = ref.child(this.params.from).child('tweets');
    let orderBy = this.params.timeline !== 'all'
      ? 'time'
      : this.params.sort;

    underhoodRef
      .orderByChild(orderBy)
      .limitToLast(this.tweetsToLoad)
      .once('value', (snap)=> {
        this.extractIds(snap.val());
        if (this.tweetsCount) {
          this.appendPage();
        } else {
          hood.status = 'empty';
        }
      });

  }

  extractIds(obj) {
    // convert tweets object to array
    let arr = Object.keys(obj).map(key => obj[key]);
    // sort tweets by criteria
    arr = arr.sort(sortFuncs[this.params.sort]);

    if (this.params.timeline !== 'all') {
      let now = new Date();
      let msDaysDivider = 1000 * 60 * 60 * 24;

      arr = arr.filter(function(el) {
        let diff = (now - el.time) / msDaysDivider;
        if (diff > 8) return false;
        return true;
      });
    }

    this.tweetsCount = arr.length;
    this.ids = arr.map( el => el.id );
  }

  appendPage() {
    let fr = this.currentEndingTweet;
    let to = fr + this.tweetsPerPage;
    let newPageTweets = this.ids.slice(fr, to);

    face.renderPage(newPageTweets, this.currentEndingTweet + 1);
    this.currentEndingTweet += this.tweetsPerPage;
    this.currentEndingTweet = Math.min(this.currentEndingTweet, this.tweetsCount);
  }

  onSettingsChange() {
    this.setParams();
    this.loadTweets();
  }

  onTweetRender() {
    if (++this.current < this.currentEndingTweet) return;

    setTimeout(()=> {
      hood.status = 'rendered';
      if (this.current >= this.tweetsCount) hood.status = 'end';
    }, 500);
  }

  initEvents() {
    d.on({
      tweetRendered: this.onTweetRender.bind(this),
      loadMoreTweets: this.appendPage.bind(this),
      settingsChanged: this.onSettingsChange.bind(this),
    });
  }

}

new Underhood();
