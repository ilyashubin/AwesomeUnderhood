import serialize from 'form-serialize';
import Jump from 'jump.js';
import hood from './hood';
import debounce from '../lib/debounce';

let d = $(document);
let jump = new Jump();

/**
 * DOM sync and manipulations
 */

export default class Face {
  constructor() {
    this.container = $('.content__tweets');
    this.status = $('.content__status');
    this.settings = $('.header__settings');
    this.select = $('select');

    this.handleStatus();
    this.initEvents();
  }

  syncFormControls(params) {
    this.select.find(`option[value="${params.from}"]`).prop('selected', true);
    for (let p in params) {
      $(`input[name="${p}"][value="${params[p]}"]`).prop('checked', true);
    }
    this.select.selectOrDie('update');
    this.settings.addClass('is-visible');
  }

  handleStatus(value) {
    hood.observe('status', status => {
      this.status.attr('s', status);
      status === 'rendered' && this.onPageRenderEnd();
    });
  }

  clearList() {
    this.container.html('');
    hood.status = 'loading';
  }

  onPageRenderEnd() {
    $('.content__page').addClass('is-visible');
  }

  renderPage(ids, currentTweetNumber) {
    hood.status = 'loading';

    let fragment = document.createDocumentFragment();
    let tweets = [];
    ids.forEach((id)=> {
      let tweetEl = $("<div class='content__tweet'>");
      let numberEl = $("<div class='content__tweet-number'>")
        .text(currentTweetNumber++);

      tweetEl.append(numberEl);

      tweets.push(tweetEl[0]);
      fragment.appendChild(tweetEl[0]);
    });

    $("<div class='content__page'>").append(fragment)
      .appendTo(this.container);

    // render tweets itself
    ids.forEach((id, i)=> {
      twttr.widgets.createTweet(id, tweets[i], { linkColor: '#58cb73' })
        .then( e => d.trigger('tweetRendered'));
    });

  }

  onSettingsChange(isForm) {
    let settings = isForm
      ? '?' + serialize(this.settings[0])
      : location.search;

    isForm && history.pushState({ path: settings }, '', settings);
    this.clearList();
    d.trigger('settingsChanged');
  }

  initEvents() {
    let offset;
    let cont = this.container[0];
    $(window).on('scroll', debounce((e)=> {
      offset = cont.getBoundingClientRect().bottom - window.innerHeight;
      if ( offset > 0 || hood.status !== 'rendered' ) return;
      d.trigger('loadMoreTweets');
    }, 250));

    this.settings.on('change', this.onSettingsChange.bind(this, true));
    $(window).on('popstate', this.onSettingsChange.bind(this, false));

    $('#scrolltop').on('click', function(e) {
      e.preventDefault();
      jump.jump('body', {
        duration: 500,
      });
    });

    this.select.selectOrDie();
  }
}
