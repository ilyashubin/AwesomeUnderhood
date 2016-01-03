import serialize from 'form-serialize';
import Jump from 'jump.js';
import hood from './hood';

var d = $(document);
var jump = new Jump();

/**
 * DOM sync and manipulations
 */

export default class Face {
  constructor() {
    this.container = $('.content__tweets');
    this.status = $('.content__status');
    this.settings = $('.header__settings');
    this.select = $('select');

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

  setStatus(value) {
    this.status.attr('s', value);
    hood.status = value;
  }

  clearList() {
    this.container.html('');
    this.setStatus('loading');
  }

  onPageRenderEnd() {
    this.setStatus('loaded');
    $('.content__page').addClass('is-visible');
  }

  renderPage(ids, currentTweetNumber) {
    this.setStatus('loading');

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
      if (
        offset > 0
        || hood.loading
        || hood.status === 'empty'
        || hood.status === 'error'
      ) return;
      hood.loading = true;
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


/**
 * Helpers
 */

function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};
