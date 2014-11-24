'use strict';

/** @jsx React.DOM */
var React = require('react/addons');
var emptyFunction = require('react/lib/emptyFunction');

function createUIEvent(draggable) {
	return {
		position: {
			top: draggable.state.offsetTop,
			left: draggable.state.offsetLeft
		}
	};
}

function canDragY(draggable) {
	return draggable.props.axis === 'both' ||
			draggable.props.axis === 'y';
}

function canDragX(draggable) {
	return draggable.props.axis === 'both' ||
			draggable.props.axis === 'x';
}

function isFunction(func) {
	return typeof func === 'function' || Object.prototype.toString.call(func) === '[object Function]'
}

// @credits https://gist.github.com/rogozhnikoff/a43cfed27c41e4e68cdc
function findInArray(array, callback) {
	for (var i = 0, length = array.length, element = null; i < length, element = array[i]; i++) {
		if (callback.apply(callback, [element, i, array])) return element;
	}
}

function matchesSelector(el, selector) {
	var method = findInArray([
		'matches',
		'webkitMatchesSelector',
		'mozMatchesSelector',
		'msMatchesSelector',
		'oMatchesSelector'
	], function(method){
		return isFunction(el[method]);
	});

	return el[method].call(el, selector);
}

// @credits: http://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript/4819886#4819886
var isTouchDevice = 'ontouchstart' in window // works on most browsers
		|| 'onmsgesturechange' in window; // works on ie10 on ms surface

// look ::handleDragStart
//function isMultiTouch(e) {
//  return e.touches && Array.isArray(e.touches) && e.touches.length > 1
//}

/**
 * simple abstraction for dragging events names
 * */
var dragEventFor = (function () {
	var eventsFor = {
		touch: {
			start: 'touchstart',
			move: 'touchmove',
			end: 'touchend'
		},
		mouse: {
			start: 'mousedown',
			move: 'mousemove',
			end: 'mouseup'
		}
	};
	return eventsFor[isTouchDevice ? 'touch' : 'mouse'];
})();

/**
 * get {clientX, clientY} positions of control
 * */
function getControlPosition(e) {
	var position = !isTouchDevice ? e : e.touches[0];
	return {
		clientX: position.clientX,
		clientY: position.clientY
	}
}

function addEvent(el, event, handler) {
	if (!el) { return; }
	if (el.attachEvent) {
		el.attachEvent('on' + event, handler);
	} else if (el.addEventListener) {
		el.addEventListener(event, handler, true);
	} else {
		el['on' + event] = handler;
	}
}

function removeEvent(el, event, handler) {
	if (!el) { return; }
	if (el.detachEvent) {
		el.detachEvent('on' + event, handler);
	} else if (el.removeEventListener) {
		el.removeEventListener(event, handler, true);
	} else {
		el['on' + event] = null;
	}
}

module.exports = React.createClass({
	displayName: 'Draggable',

	propTypes: {
		/**
		 * `axis` determines which axis the draggable can move.
		 *
		 * 'both' allows movement horizontally and vertically.
		 * 'x' limits movement to horizontal axis.
		 * 'y' limits movement to vertical axis.
		 *
		 * Defaults to 'both'.
		 */
		axis: React.PropTypes.oneOf(['both', 'x', 'y']),

		/**
		 * `bound` determines whether to bound the movement to the parent box.
		 *
		 * Defaults to false.
		 */
		bound: React.PropTypes.bool,

		/**
		 * `handle` specifies a selector to be used as the handle that initiates drag.
		 *
		 * Example:
		 *
		 * ```jsx
		 * 	var App = React.createClass({
		 * 	    render: function () {
		 * 	    	return (
		 * 	    	 	<Draggable handle=".handle">
		 * 	    	 	  <div>
		 * 	    	 	      <div className="handle">Click me to drag</div>
		 * 	    	 	      <div>This is some other content</div>
		 * 	    	 	  </div>
		 * 	    		</Draggable>
		 * 	    	);
		 * 	    }
		 * 	});
		 * ```
		 */
		handle: React.PropTypes.string,

		/**
		 * `cancel` specifies a selector to be used to prevent drag initialization.
		 *
		 * Example:
		 *
		 * ```jsx
		 * 	var App = React.createClass({
		 * 	    render: function () {
		 * 	        return(
		 * 	            <Draggable cancel=".cancel">
		 * 	                <div>
		 * 	                	<div className="cancel">You can't drag from here</div>
		 *						<div>Dragging here works fine</div>
		 * 	                </div>
		 * 	            </Draggable>
		 * 	        );
		 * 	    }
		 * 	});
		 * ```
		 */
		cancel: React.PropTypes.string,

		/**
		 * `grid` specifies the x and y that dragging should snap to.
		 *
		 * Example:
		 *
		 * ```jsx
		 * 	var App = React.createClass({
		 * 	    render: function () {
		 * 	        return (
		 * 	            <Draggable grid={[25, 25]}>
		 * 	                <div>I snap to a 25 x 25 grid</div>
		 * 	            </Draggable>
		 * 	        );
		 * 	    }
		 * 	});
		 * ```
		 */
		grid: React.PropTypes.arrayOf(React.PropTypes.number),

		/**
		 * `start` specifies the x and y that the dragged item should start at
		 *
		 * Example:
		 *
		 * ```jsx
		 * 	var App = React.createClass({
		 * 	    render: function () {
		 * 	        return (
		 * 	            <Draggable start={{x: 25, y: 25}}>
		 * 	                <div>I start with left: 25px; top: 25px;</div>
		 * 	            </Draggable>
		 * 	        );
		 * 	    }
		 * 	});
		 * ```
		 */
		start: React.PropTypes.object,

		/**
		 * `zIndex` specifies the zIndex to use while dragging.
		 *
		 * Example:
		 *
		 * ```jsx
		 * 	var App = React.createClass({
		 * 	    render: function () {
		 * 	        return (
		 * 	            <Draggable zIndex={100}>
		 * 	                <div>I have a zIndex</div>
		 * 	            </Draggable>
		 * 	        );
		 * 	    }
		 * 	});
		 * ```
		 */
		zIndex: React.PropTypes.number,

		/**
		 * `useChild` determines whether to use the first child as root.
		 *
		 * If false, a div is created. This option is required if any children
		 * have a ref.
		 *
		 * Defaults to true.
		 */
		useChild: React.PropTypes.bool,

		/**
		 * Called when dragging starts.
		 *
		 * Example:
		 *
		 * ```js
		 *	function (event, ui) {}
		 * ```
		 *
		 * `event` is the Event that was triggered.
		 * `ui` is an object:
		 *
		 * ```js
		 *	{
		 *		position: {top: 0, left: 0}
		 *	}
		 * ```
		 */
		onStart: React.PropTypes.func,

		/**
		 * Called while dragging.
		 *
		 * Example:
		 *
		 * ```js
		 *	function (event, ui) {}
		 * ```
		 *
		 * `event` is the Event that was triggered.
		 * `ui` is an object:
		 *
		 * ```js
		 *	{
		 *		position: {top: 0, left: 0}
		 *	}
		 * ```
		 */
		onDrag: React.PropTypes.func,

		/**
		 * Called when dragging stops.
		 *
		 * Example:
		 *
		 * ```js
		 *	function (event, ui) {}
		 * ```
		 *
		 * `event` is the Event that was triggered.
		 * `ui` is an object:
		 *
		 * ```js
		 *	{
		 *		position: {top: 0, left: 0}
		 *	}
		 * ```
		 */
		onStop: React.PropTypes.func,

		/**
		 * A workaround option which can be passed if onMouseDown needs to be accessed, since it'll always be blocked (due to that there's internal use of onMouseDown)
		 *
		 */
		onMouseDown: React.PropTypes.func
	},

	componentWillUnmount: function() {
		// Remove any leftover event handlers
		removeEvent(window, dragEventFor['move'], this.handleDrag);
		removeEvent(window, dragEventFor['end'], this.handleDragEnd);
	},

	getDefaultProps: function () {
		return {
			axis: 'both',
			bound: false,
			handle: null,
			cancel: null,
			grid: null,
			start: {
				x: 0,
				y: 0
			},
			zIndex: NaN,
			useChild: true,
			onStart: emptyFunction,
			onDrag: emptyFunction,
			onStop: emptyFunction,
			onMouseDown: emptyFunction
		};
	},

	getInitialState: function () {
		return {
			// Whether or not currently dragging
			dragging: false,

			// DOMNode offset relative to HTMLElement.offsetParent
			offsetLeft: this.props.start.x, offsetTop: this.props.start.y
		};
	},

	componentWillReceiveProps: function (nextProps) {
		if (nextProps.start) {
			this.setState({
				offsetLeft: nextProps.start.x,
				offsetTop: nextProps.start.y
			});
		}
	},

	handleDragStart: function (e) {
		// todo: write right implementation to prevent multitouch drag
		// prevent multi-touch events
		// if (isMultiTouch(e)) {
		//     this.handleDragEnd.apply(e, arguments);
		//     return
		// }

		// Make it possible to attach event handlers on top of this one
		this.props.onMouseDown(e);

		// Short circuit if handle or cancel prop was provided and selector doesn't match
		if ((this.props.handle && !matchesSelector(e.target, this.props.handle)) ||
			(this.props.cancel && matchesSelector(e.target, this.props.cancel))) {
			return;
		}

		// Initiate dragging
		this.setState({
			dragging: true
		});

		// Call event handler
		this.props.onStart(e, createUIEvent(this));

		// Add event handlers
		addEvent(window, dragEventFor['move'], this.handleDrag);
		addEvent(window, dragEventFor['end'], this.handleDragEnd);
	},

	handleDragEnd: function (e) {
		// Short circuit if not currently dragging
		if (!this.state.dragging) {
			return;
		}

		// Turn off dragging
		this.setState({
			dragging: false
		});

		// Call event handler
		this.props.onStop(e, createUIEvent(this));

		// Remove event handlers
		removeEvent(window, dragEventFor['move'], this.handleDrag);
		removeEvent(window, dragEventFor['end'], this.handleDragEnd);
	},

	handleDrag: function (e) {
		var offset, snap, remainder;

		var dragPoint = getControlPosition(e);
		var state = {};

		// Get DOM nodes
		var node = this.getDOMNode();
		var parentNode = node.parentNode;
		var boundingClientRect = parentNode.getBoundingClientRect();

		if (canDragX(this)) {
			// Calculate updated position
			offset = dragPoint.clientX - boundingClientRect.left;
			// Bound movement to parent box
			if (this.props.bound) {
				if (offset < 0) {
					offset = 0;
				} else if (offset > parentNode.clientWidth) {
					offset = parentNode.clientWidth;
				}
			}
			// Snap to grid if prop has been provided
			if (this.props.grid && (snap = this.props.grid[0])) {
				remainder = offset % snap;
				offset -= remainder;
				if (remainder >= snap / 2) {
					offset += snap;
				}
			}
			// Update top
			state.offsetLeft = offset;
		}

		if (canDragY(this)) {
			// Calculate updated position
			offset = dragPoint.clientY - boundingClientRect.top;
			// Bound movement to parent box
			if (this.props.bound) {
				if (offset < 0) {
					offset = 0;
				} else if (offset > parentNode.clientHeight) {
					offset = parentNode.clientHeight;
				}
			}
			// Snap to grid if prop has been provided
			if (this.props.grid && (snap = this.props.grid[1])) {
				remainder = offset % snap;
				offset -= remainder;
				if (remainder >= snap / 2) {
					offset += snap;
				}
			}
			// Update top
			state.offsetTop = offset;
		}

		// Update top and left
		this.setState(state);

		// Call event handler
		this.props.onDrag(e, createUIEvent(this));
	},

	onTouchStart: function (e) {
		e.preventDefault(); // prevent for scroll
		return this.handleDragStart.apply(this, arguments);
	},

	render: function () {
		var style = {
			top: this.state.offsetTop,
			left: this.state.offsetLeft
		};

		// Set zIndex if currently dragging and prop has been provided
		if (this.state.dragging && !isNaN(this.props.zIndex)) {
			style.zIndex = this.props.zIndex;
		}

		var props = {
			style: style,
			className: 'react-draggable',

			onMouseDown: this.handleDragStart,
			onTouchStart: this.onTouchStart,

			onMouseUp: this.handleDragEnd,
			onTouchEnd: this.handleDragEnd
		};

		// Reuse the child provided
		// This makes it flexible to use whatever element is wanted (div, ul, etc)
		if (this.props.useChild) {
			return React.addons.cloneWithProps(React.Children.only(this.props.children), props);
		}

		return React.DOM.div(props, this.props.children);
	}
});
