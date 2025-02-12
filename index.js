'use strict';

/**
 * Module dependencies
 */
var decouple = require('decouple');
var Emitter = require('emitter');

/**
 * Privates
 */
var scrollTimeout;
var scrolling = false;
var doc = window.document;
var html = doc.documentElement;
var msPointerSupported = window.navigator.msPointerEnabled;
var touch = {
  'start': msPointerSupported ? 'MSPointerDown' : 'touchstart',
  'move': msPointerSupported ? 'MSPointerMove' : 'touchmove',
  'end': msPointerSupported ? 'MSPointerUp' : 'touchend'
};
var prefix = (function prefix() {
  var regex = /^(Webkit|Khtml|Moz|ms|O)(?=[A-Z])/;
  var styleDeclaration = doc.getElementsByTagName('script')[0].style;
  for (var prop in styleDeclaration) {
    if (regex.test(prop)) {
      return '-' + prop.match(regex)[0].toLowerCase() + '-';
    }
  }
  // Nothing found so far? Webkit does not enumerate over the CSS properties of the style object.
  // However (prop in style) returns the correct value, so we'll have to test for
  // the precence of a specific property
  if ('WebkitOpacity' in styleDeclaration) { return '-webkit-'; }
  if ('KhtmlOpacity' in styleDeclaration) { return '-khtml-'; }
  return '';
}());
function extend(destination, from) {
  for (var prop in from) {
    if (from[prop]) {
      destination[prop] = from[prop];
    }
  }
  return destination;
}
function inherits(child, uber) {
  child.prototype = extend(child.prototype || {}, uber.prototype);
}

/**
 * Slideout constructor
 */
function Slideout(options) {
  options = options || {};
  // Store the options
  this._options = options;

  // Sets default values
  this._startOffsetX = 0;
  this._currentOffsetX = 0;
  this._opening = false;
  this._moved = false;
  this._opened = false;
  this._preventOpen = false;
  this._touch = options.touch === undefined ? true : options.touch && true;
  this._grabWidth = parseInt(options.grabWidth, 10) || 0;
  // Sets panel
  this.panel = options.panel;
  this.menu = options.menu;

  // Sets  classnames
  if(this.panel.className.search('slideout-panel') === -1) { this.panel.className += ' slideout-panel'; }
  if(this.menu.className.search('slideout-menu') === -1) { this.menu.className += ' slideout-menu'; }

  if ((options.itemToMove == 'menu' || options.itemToMove == 'both') && this.menu.className.search('slideout-menu--move') === -1) {
    this.menu.className += ' slideout-menu--move';
  }

  // Sets options
  this._fx = options.fx || 'ease';
  this._duration = parseInt(options.duration, 10) || 300;
  this._tolerance = parseInt(options.tolerance, 10) || 70;
  this._padding = this._translateTo = parseInt(options.padding, 10) || 256;
  this._orientation = options.side === 'right' ? -1 : 1;
  this._translateTo *= this._orientation;

  // Init touch events
  if (this._touch) {
    this._initTouchEvents();
  }
}

/**
 * Inherits from Emitter
 */
inherits(Slideout, Emitter);

/**
 * Opens the slideout menu.
 */
Slideout.prototype.open = function() {
  var self = this;
  this.emit('beforeopen');
  if (html.className.search('slideout-open') === -1) { html.className += ' slideout-open'; }
  this._setTransition();
  self._recalculateAll();
  this._translateXTo(this._translateTo);
  this._opened = true;
  setTimeout(function() {
    if (self._options.itemToMove == "panel" || self._options.itemToMove == "both" || self._options.itemToMove == undefined) {
      self.panel.style.transition = self.panel.style['-webkit-transition'] = '';
    }
    if (self._options.itemToMove == "menu" || self._options.itemToMove == "both") {
      self.menu.style.transition = self.menu.style['-webkit-transition'] = '';
    }
    self.emit('open');
  }, this._duration + 50);
  return this;
};

/**
 * Closes slideout menu.
 */
Slideout.prototype.close = function() {
  var self = this;
  if (!this.isOpen() && !this._opening) {
    return this;
  }
  this.emit('beforeclose');
  this._setTransition();
  this._translateXTo(0);
  this._opened = false;
  setTimeout(function() {
    html.className = html.className.replace(/ slideout-open/, '');
    if (self._options.itemToMove == "panel" || self._options.itemToMove == "both" || self._options.itemToMove == undefined) {
      self.panel.style.transition = self.panel.style['-webkit-transition'] = self.panel.style[prefix + 'transform'] = self.panel.style.transform = '';
    }
    if (self._options.itemToMove == "menu" || self._options.itemToMove == "both") {
      self.menu.style.transition = self.menu.style['-webkit-transition'] = self.menu.style[prefix + 'transform'] = self.menu.style.transform = '';
    }
    self.emit('close');
  }, this._duration + 50);
  return this;
};

/**
 * Toggles (open/close) slideout menu.
 */
Slideout.prototype.toggle = function() {
  return this.isOpen() ? this.close() : this.open();
};

/**
 * Returns true if the slideout is currently open, and false if it is closed.
 */
Slideout.prototype.isOpen = function() {
  return this._opened;
};

/**
 * Recalculates the slide out
 */
Slideout.prototype._recalculateAll = function () {

    //this._options.padding = this.menu.clientWidth;

    // Sets default values
    this._startOffsetX = 0;
    this._currentOffsetX = 0;
    this._opening = false;
    this._moved = false;
    this._opened = false;
    this._preventOpen = false;
    this._touch = this._options.touch === undefined ? true : this._options.touch && true;
    this._menuTriggerWidth = this._options.menuTriggerWidth === undefined ? 70 : this._options.menuTriggerWidth;

    // Sets panel
    this.panel = this._options.panel;
    this.menu = this._options.menu;

    // Sets  classnames
    if (this.panel.className.search('slideout-panel') === -1) { this.panel.className += ' slideout-panel'; }
    if (this.menu.className.search('slideout-menu') === -1) { this.menu.className += ' slideout-menu'; }


    // Sets options
    this._fx = this._options.fx || 'ease';
    this._duration = parseInt(this._options.duration, 10) || 300;
    this._tolerance = parseInt(this._options.tolerance, 10) || 70;
    this._padding = this._translateTo = parseInt(this._options.padding, 10) || 256;
    this._orientation = this._options.side === 'right' ? -1 : 1;
    this._translateTo *= this._orientation;
}

/**
 * Translates panel and updates currentOffset with a given X point
 */
Slideout.prototype._translateXTo = function(translateX) {
  this._currentOffsetX = translateX;
  if (this._options.itemToMove == "panel" || this._options.itemToMove == "both" || this._options.itemToMove == undefined) {
    this.panel.style[prefix + 'transform'] = this.panel.style.transform = 'translateX(' + translateX + 'px)';
  }
  if (this._options.itemToMove == "menu" || this._options.itemToMove == "both") {
    this.menu.style[prefix + 'transform'] = this.menu.style.transform = 'translate3d(' + (translateX - this.menu.clientWidth) + 'px, 0, 0)';
  }

  return this;
};

/**
 * Set transition properties
 */
Slideout.prototype._setTransition = function() {
  if (this._options.itemToMove == "panel" || this._options.itemToMove == "both" || this._options.itemToMove == undefined) {
    this.panel.style[prefix + 'transition'] = this.panel.style.transition = prefix + 'transform ' + this._duration + 'ms ' + this._fx;
  }
  if (this._options.itemToMove == "menu" || this._options.itemToMove == "both") {
    this.menu.style[prefix + 'transition'] = this.menu.style.transition = prefix + 'transform ' + this._duration + 'ms ' + this._fx;
  }

  return this;
};

/**
 * Initializes touch event
 */
Slideout.prototype._initTouchEvents = function() {
  var self = this;

  /**
   * Decouple scroll event
   */
  this._onScrollFn = decouple(doc, 'scroll', function() {
    if (!self._moved) {
      clearTimeout(scrollTimeout);
      scrolling = true;
      scrollTimeout = setTimeout(function() {
        scrolling = false;
      }, 250);
    }
  });

  /**
   * Prevents touchmove event if slideout is moving
   */
  this._preventMove = function(eve) {
    if (self._moved) {
      eve.preventDefault();
    }
  };

  doc.addEventListener(touch.move, this._preventMove);

  /**
   * Resets values on touchstart
   */
  this._resetTouchFn = function(eve) {
    if (typeof eve.touches === 'undefined' || (eve.orignalEvent && typeof eve.originalEvent.touches === 'undefined')) {
      return;
    }
    self._moved = false;
    self._opening = false;
    if (self._orientation === 1) {
      var offset = eve.touches[0].pageX;
    } else {
      offset = window.innerWidth - eve.touches[0].pageX;
    }

    self._startOffsetX = offset;
    self._preventOpen = (!self._touch || (!self.isOpen() && (self.menu.clientWidth !== 0 || (self._grabWidth && offset > self._grabWidth))));

    self._startOffsetX = eve.touches[0].pageX;
    self._preventOpen = (!self._touch || (!self.isOpen() && self.menu.clientWidth !== 0));
  };

  this.panel.addEventListener(touch.start, this._resetTouchFn);

  /**
   * Resets values on touchcancel
   */
  this._onTouchCancelFn = function() {
    self._moved = false;
    self._opening = false;
  };

  this.panel.addEventListener('touchcancel', this._onTouchCancelFn);

  /**
   * Toggles slideout on touchend
   */
  this._onTouchEndFn = function() {
    if (self._moved) {
      self.emit('translateend');
      (self._opening && Math.abs(self._currentOffsetX) > self._tolerance) ? self.open() : self.close();
    }
    self._moved = false;
  };

  this.panel.addEventListener(touch.end, this._onTouchEndFn);

  /**
   * Translates panel on touchmove
   */
  this._onTouchMoveFn = function(eve) {

    if (self._startOffsetX > self._menuTriggerWidth && !self.isOpen() && self._options.itemToMove == 'menu') {
      return;
    }

    if (scrolling || self._preventOpen || typeof eve.touches === 'undefined') {
      return;
    }

    var dif_x = eve.touches[0].clientX - self._startOffsetX;
    var translateX = self._currentOffsetX = dif_x;

    if (Math.abs(translateX) > self._padding) {
      return;
    }

    if (Math.abs(dif_x) > 20) {

      self._opening = true;

      var oriented_dif_x = dif_x * self._orientation;

      if (self._opened && oriented_dif_x > 0 || !self._opened && oriented_dif_x < 0) {
        return;
      }

      if (!self._moved) {
        self.emit('translatestart');
      }

      if (oriented_dif_x <= 0) {
        translateX = dif_x + self._padding * self._orientation;
        self._opening = false;
      }

      if (!self._moved && html.className.search('slideout-open') === -1) {
        html.className += ' slideout-open';
      }

      if (self._options.itemToMove == "panel" || self._options.itemToMove == "both" || self._options.itemToMove == undefined) {
        self.panel.style[prefix + 'transform'] = self.panel.style.transform = 'translateX(' + translateX + 'px)';
      }
      if (self._options.itemToMove == "menu" || self._options.itemToMove == "both") {
        self.menu.style[prefix + 'transform'] = self.menu.style.transform = 'translate3d(' + (translateX - self.menu.clientWidth) + 'px, 0, 0)';
      }

      self.emit('translate', translateX);
      self._moved = true;
    }

  };

  this.panel.addEventListener(touch.move, this._onTouchMoveFn);

  return this;
};

/**
 * Enable opening the slideout via touch events.
 */
Slideout.prototype.enableTouch = function() {
  this._touch = true;
  return this;
};

/**
 * Disable opening the slideout via touch events.
 */
Slideout.prototype.disableTouch = function() {
  this._touch = false;
  return this;
};

/**
 * Destroy an instance of slideout.
 */
Slideout.prototype.destroy = function() {
  // Close before clean
  this.close();

  // Remove event listeners
  doc.removeEventListener(touch.move, this._preventMove);
  this.panel.removeEventListener(touch.start, this._resetTouchFn);
  this.panel.removeEventListener('touchcancel', this._onTouchCancelFn);
  this.panel.removeEventListener(touch.end, this._onTouchEndFn);
  this.panel.removeEventListener(touch.move, this._onTouchMoveFn);
  doc.removeEventListener('scroll', this._onScrollFn);

  // Remove methods
  this.open = this.close = function() {};

  // Return the instance so it can be easily dereferenced
  return this;
};

/**
 * Expose Slideout
 */
module.exports = Slideout;
