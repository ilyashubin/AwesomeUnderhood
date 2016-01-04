
/**
 * Common state object
 */

let data = {
  _status: 'loading',
  get status() {
    return this._status;
  },
  set status(val) {
    if (observables.status)
      observables.status.forEach( el => el.call(this, val))
    this._status = val;
  },
};

let observables = {};
data.observe = function(path, cb) {
  if (!observables[path]) observables[path] = [];
  observables[path].push(cb);
}

export default data;
