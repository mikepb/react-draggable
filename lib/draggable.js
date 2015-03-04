'use strict';

var React = require('react/addons');
var emptyFunction = function () {};

// for accessing browser globals
var root = typeof window !== 'undefined' ? window : this;
var bodyElement;
if (typeof document !== 'undefined' && 'body' in document) {
	bodyElement = document.body;
}

function updateBoundState (state, bound) {
	if (!bound) return state;
	bound = String(bound);
	var boundTop = !!~bound.indexOf('top');
	var boundRight = !!~bound.indexOf('right');
	var boundBottom = !!~bound.indexOf('bottom');
	var boundLeft = !!~bound.indexOf('left');
	var boundAll = !!~bound.indexOf('all') ||
		!(boundTop || boundRight || boundBottom || boundLeft);
	var boundBox = !~bound.indexOf('point');
	state.boundTop = boundAll || boundTop;
	state.boundRight = boundAll || boundRight;
	state.boundBottom = boundAll || boundBottom;
	state.boundLeft = boundAll || boundLeft;
	state.boundBox = boundBox;
	return state;
};

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
var isTouchDevice = 'ontouchstart' in root // works on most browsers
								 || 'onmsgesturechange' in root; // works on ie10 on ms surface

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
	var position = (e.touches && e.touches[0]) || e;
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
	mixins: [React.addons.PureRenderMixin],

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
		 * `bound` determines whether to bound the movement to the parent box.
		 *
		 * The property takes a list of space-separated strings. The Draggable
		 * is bounded by the nearest DOMNode.offsetParent. To set the offset
		 * parent, give it a position value other than 'static'.
		 *
		 * Optionally choose one or more bounds from:
		 * 'top' bounds movement to the top edge of the parent box.
		 * 'right' bounds movement to the right edge of the parent box.
		 * 'bottom' bounds movement to the bottom edge of the parent box.
		 * 'left' bounds movement to the left edge of the parent box.
		 * 'all' bounds movement to all edges (default if not specified).
		 *
		 * Optionally choose one anchor from:
		 * 'point' to constrain only the top-left corner.
		 * 'box' to constrain the entire box (default if not specified).
		 *
		 * You may use more than one bound, e.g. 'top left point'. Set to a
		 * falsy value to disable.
		 *
		 * Defaults to 'all box'.
		 */
		bound: React.PropTypes.string,

		/**
		 * `grid` specifies the x and y that dragging should snap to.
		 *
		 * Example:
		 *
		 * ```jsx
		 *   var App = React.createClass({
		 *       render: function () {
		 *           return (
		 * 	            <Draggable grid={[25, 25]}>
		 *                   <div>I snap to a 25 x 25 grid</div>
		 *               </Draggable>
		 *           );
		 * 	    }
		 *   });
		 * ```
		 */
		grid: React.PropTypes.arrayOf(React.PropTypes.number),

		/**
		 * `constrain` takes a function to constrain the dragging.
		 *
		 * Example:
		 *
		 * ```jsx
		 *   function constrain (snap) {
		 *         function constrainOffset (offset, prev) {
		 *               var delta = offset - prev;
		 *               if (Math.abs(delta) >= snap) {
		 *                     return prev + (delta < 0 ? -snap : snap);
		 *               }
		 *               return prev;
		 *         }
		 *         return function (pos) {
		 *               return {
		 *                     top: constrainOffset(pos.top, pos.prevTop),
		 *                     left: constrainOffset(pos.left, pos.prevLeft)
		 *               };
		 *         };
		 *   }
		 *   var App = React.createClass({
		 *       render: function () {
		 *           return (
		 *               <Draggable constrain={constrain}>
		 *                   <div>I snap to a 25 x 25 grid</div>
		 *               </Draggable>
		 *           );
		 *       }
		 *   });
		 * ```
		 */
		constrain: React.PropTypes.func,

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

	getDefaultProps: function () {
		return {
			axis: 'both',
			bound: null,
			handle: null,
			cancel: null,
			grid: null,
			start: {},
			zIndex: NaN,
			useChild: true,
			onStart: emptyFunction,
			onDrag: emptyFunction,
			onStop: emptyFunction,
			onMouseDown: emptyFunction
		};
	},

	getInitialState: function () {
		var state = {
			// Whether or not currently dragging
			dragging: false,

			// Pointer offset on screen
			clientX: 0, clientY: 0,

			// DOMNode offset relative to parent
			offsetLeft: this.props.start.x || 0, offsetTop: this.props.start.y || 0
		};

		updateBoundState(state, this.props.bound);

		return state;
	},

	componentWillReceiveProps: function (nextProps) {
		var state = updateBoundState({}, nextProps.bound);
		if (nextProps.start) {
			if (nextProps.start.x != null) {
				state.offsetLeft = nextProps.start.x || 0;
			}
			if (nextProps.start.y != null) {
				state.offsetTop = nextProps.start.y || 0;
			}
		}
		this.setState(state);
	},

	componentWillUnmount: function() {
		// Remove any leftover event handlers
		removeEvent(root, dragEventFor['move'], this.handleDrag);
		removeEvent(root, dragEventFor['end'], this.handleDragEnd);
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

		var dragPoint = getControlPosition(e);

		// Initiate dragging
		this.setState({
			dragging: true,
			clientX: dragPoint.clientX,
			clientY: dragPoint.clientY
		});

		// Call event handler
		this.props.onStart(e, createUIEvent(this));

		// Add event handlers
		addEvent(root, dragEventFor['move'], this.handleDrag);
		addEvent(root, dragEventFor['end'], this.handleDragEnd);

		// Add dragging class to body element
		if (bodyElement) bodyElement.className += ' react-draggable-dragging';
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
		removeEvent(root, dragEventFor['move'], this.handleDrag);
		removeEvent(root, dragEventFor['end'], this.handleDragEnd);

		// Remove dragging class from body element
		if (bodyElement) {
			var className = bodyElement.className;
			bodyElement.className =
				className.replace(/(?:^|\s+)react-draggable-dragging\b/, ' ');
		}
	},

	handleDrag: function (e) {
		var dragPoint = getControlPosition(e);
		var offsetLeft = this._toPixels(this.state.offsetLeft);
		var offsetTop = this._toPixels(this.state.offsetTop);

		var state = {
			offsetLeft: offsetLeft,
			offsetTop: offsetTop
		};

		// Get parent DOM node
		var node = this.getDOMNode();
		var offsetParent = node.offsetParent;
		var offset, boundingValue;

		if (canDragX(this)) {
			// Calculate updated position
			offset = offsetLeft + dragPoint.clientX - this.state.clientX;

			// Bound movement to parent box
			if (this.state.boundLeft) {
				boundingValue = state.offsetLeft - node.offsetLeft;
				if (offset < boundingValue) {
					offset = boundingValue;
				}
			}
			if (this.state.boundRight) {
				boundingValue += offsetParent.clientWidth;
				if (this.state.boundBox) {
					boundingValue -= node.offsetWidth;
				}
				if (offset > boundingValue) {
					offset = boundingValue;
				}
			}
			// Update left
			state.offsetLeft = offset;
		}

		if (canDragY(this)) {
			// Calculate updated position
			offset = offsetTop + dragPoint.clientY - this.state.clientY;
			// Bound movement to parent box
			if (this.state.boundTop) {
				boundingValue = state.offsetTop - node.offsetTop;
				if (offset < boundingValue) {
					offset = boundingValue;
				}
			}
			if (this.state.boundBottom) {
				boundingValue += offsetParent.clientHeight;
				if (this.state.boundBox) {
					boundingValue -= node.offsetHeight;
				}
				if (offset > boundingValue) {
					offset = boundingValue;
				}
			}
			// Update top
			state.offsetTop = offset;
		}

		var constrain = this.props.constrain;
		var grid = this.props.grid;

		// Backwards-compatibility for snap to grid
		if (!constrain && Array.isArray(grid)) {
			var constrainOffset = function (offset, prev, snap) {
				var delta = offset - prev;
				if (Math.abs(delta) >= snap) {
					return prev + parseInt(delta / snap, 10) * snap;
				}
				return prev;
			};
			constrain = function (pos) {
				return {
					left: constrainOffset(pos.left, pos.prevLeft, grid[0]),
					top: constrainOffset(pos.top, pos.prevTop, grid[1])
				};
			};
		}

		// Constrain if function has been provided
		var positions;
		if (constrain) {
			// Constrain positions
			positions = constrain({
				prevLeft: this.state.offsetLeft,
				prevTop: this.state.offsetTop,
				left: state.offsetLeft,
				top: state.offsetTop
			});
			if (positions) {
				// Update left
				if ('left' in positions && !isNaN(positions.left)) {
					state.offsetLeft = positions.left;
				}
				// Update top
				if ('top' in positions && !isNaN(positions.top)) {
					state.offsetTop = positions.top;
				}
			}
		}

		// Save new state
		state.clientX = this.state.clientX + (state.offsetLeft - offsetLeft);
		state.clientY = this.state.clientY + (state.offsetTop - offsetTop);
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
	},

	_toPixels: function (value) {

		// Support percentages
		if (typeof value == 'string' && value.slice(-1) == '%') {
			return parseInt((+value.replace('%', '') / 100) *
				this.getDOMNode().offsetParent.clientWidth, 10) || 0;
		}

		// Invalid values become zero
		var i = parseInt(value, 10);
		if (isNaN(i) || !isFinite(i)) return 0;

		return i;
	}

});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtZWQuanMiLCJzb3VyY2VzIjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7QUFFYixJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDcEMsSUFBSSxhQUFhLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQzs7QUFFbkMsZ0NBQWdDO0FBQ2hDLElBQUksSUFBSSxHQUFHLE9BQU8sTUFBTSxLQUFLLFdBQVcsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDO0FBQ3pELElBQUksV0FBVyxDQUFDO0FBQ2hCLElBQUksT0FBTyxRQUFRLEtBQUssV0FBVyxJQUFJLE1BQU0sSUFBSSxRQUFRLEVBQUU7Q0FDMUQsV0FBVyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7QUFDN0IsQ0FBQzs7QUFFRCxTQUFTLGdCQUFnQixFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUN6QyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxDQUFDO0NBQ3pCLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDdEIsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUN2QyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0NBQzNDLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Q0FDN0MsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUN6QyxJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztFQUNyQyxFQUFFLFFBQVEsSUFBSSxVQUFVLElBQUksV0FBVyxJ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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTTtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQ3ZEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNO0FBQy9CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3ZGLEdBQUc7O0VBRUQsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNuRCxFQUFFOztBQUVGLENBQUMsU0FBUyxFQUFFLFVBQVUsS0FBSyxFQUFFLENBQUM7QUFDOUI7O0VBRUUsSUFBSSxPQUFPLEtBQUssSUFBSSxRQUFRLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsRUFBRTtHQUN2RCxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRztJQUM3QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDekQsR0FBRztBQUNIOztFQUVFLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDOUIsRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQzs7RUFFdkMsT0FBTyxDQUFDLENBQUM7QUFDWCxFQUFFOztDQUVELENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QvYWRkb25zJyk7XG52YXIgZW1wdHlGdW5jdGlvbiA9IGZ1bmN0aW9uICgpIHt9O1xuXG4vLyBmb3IgYWNjZXNzaW5nIGJyb3dzZXIgZ2xvYmFsc1xudmFyIHJvb3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHRoaXM7XG52YXIgYm9keUVsZW1lbnQ7XG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiAnYm9keScgaW4gZG9jdW1lbnQpIHtcblx0Ym9keUVsZW1lbnQgPSBkb2N1bWVudC5ib2R5O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVCb3VuZFN0YXRlIChzdGF0ZSwgYm91bmQpIHtcblx0aWYgKCFib3VuZCkgcmV0dXJuIHN0YXRlO1xuXHRib3VuZCA9IFN0cmluZyhib3VuZCk7XG5cdHZhciBib3VuZFRvcCA9ICEhfmJvdW5kLmluZGV4T2YoJ3RvcCcpO1xuXHR2YXIgYm91bmRSaWdodCA9ICEhfmJvdW5kLmluZGV4T2YoJ3JpZ2h0Jyk7XG5cdHZhciBib3VuZEJvdHRvbSA9ICEhfmJvdW5kLmluZGV4T2YoJ2JvdHRvbScpO1xuXHR2YXIgYm91bmRMZWZ0ID0gISF+Ym91bmQuaW5kZXhPZignbGVmdCcpO1xuXHR2YXIgYm91bmRBbGwgPSAhIX5ib3VuZC5pbmRleE9mKCdhbGwnKSB8fFxuXHRcdCEoYm91bmRUb3AgfHwgYm91bmRSaWdodCB8fCBib3VuZEJvdHRvbSB8fCBib3VuZExlZnQpO1xuXHR2YXIgYm91bmRCb3ggPSAhfmJvdW5kLmluZGV4T2YoJ3BvaW50Jyk7XG5cdHN0YXRlLmJvdW5kVG9wID0gYm91bmRBbGwgfHwgYm91bmRUb3A7XG5cdHN0YXRlLmJvdW5kUmlnaHQgPSBib3VuZEFsbCB8fCBib3VuZFJpZ2h0O1xuXHRzdGF0ZS5ib3VuZEJvdHRvbSA9IGJvdW5kQWxsIHx8IGJvdW5kQm90dG9tO1xuXHRzdGF0ZS5ib3VuZExlZnQgPSBib3VuZEFsbCB8fCBib3VuZExlZnQ7XG5cdHN0YXRlLmJvdW5kQm94ID0gYm91bmRCb3g7XG5cdHJldHVybiBzdGF0ZTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZVVJRXZlbnQoZHJhZ2dhYmxlKSB7XG5cdHJldHVybiB7XG5cdFx0cG9zaXRpb246IHtcblx0XHRcdHRvcDogZHJhZ2dhYmxlLnN0YXRlLm9mZnNldFRvcCxcblx0XHRcdGxlZnQ6IGRyYWdnYWJsZS5zdGF0ZS5vZmZzZXRMZWZ0XG5cdFx0fVxuXHR9O1xufVxuXG5mdW5jdGlvbiBjYW5EcmFnWShkcmFnZ2FibGUpIHtcblx0cmV0dXJuIGRyYWdnYWJsZS5wcm9wcy5heGlzID09PSAnYm90aCcgfHxcblx0XHRcdGRyYWdnYWJsZS5wcm9wcy5heGlzID09PSAneSc7XG59XG5cbmZ1bmN0aW9uIGNhbkRyYWdYKGRyYWdnYWJsZSkge1xuXHRyZXR1cm4gZHJhZ2dhYmxlLnByb3BzLmF4aXMgPT09ICdib3RoJyB8fFxuXHRcdFx0ZHJhZ2dhYmxlLnByb3BzLmF4aXMgPT09ICd4Jztcbn1cblxuZnVuY3Rpb24gaXNGdW5jdGlvbihmdW5jKSB7XG5cdHJldHVybiB0eXBlb2YgZnVuYyA9PT0gJ2Z1bmN0aW9uJyB8fCBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZnVuYykgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSdcbn1cblxuLy8gQGNyZWRpdHMgaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vcm9nb3pobmlrb2ZmL2E0M2NmZWQyN2M0MWU0ZTY4Y2RjXG5mdW5jdGlvbiBmaW5kSW5BcnJheShhcnJheSwgY2FsbGJhY2spIHtcblx0Zm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCwgZWxlbWVudCA9IG51bGw7IGkgPCBsZW5ndGgsIGVsZW1lbnQgPSBhcnJheVtpXTsgaSsrKSB7XG5cdFx0aWYgKGNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLCBbZWxlbWVudCwgaSwgYXJyYXldKSkgcmV0dXJuIGVsZW1lbnQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gbWF0Y2hlc1NlbGVjdG9yKGVsLCBzZWxlY3Rvcikge1xuXHR2YXIgbWV0aG9kID0gZmluZEluQXJyYXkoW1xuXHRcdCdtYXRjaGVzJyxcblx0XHQnd2Via2l0TWF0Y2hlc1NlbGVjdG9yJyxcblx0XHQnbW96TWF0Y2hlc1NlbGVjdG9yJyxcblx0XHQnbXNNYXRjaGVzU2VsZWN0b3InLFxuXHRcdCdvTWF0Y2hlc1NlbGVjdG9yJ1xuXHRdLCBmdW5jdGlvbihtZXRob2Qpe1xuXHRcdHJldHVybiBpc0Z1bmN0aW9uKGVsW21ldGhvZF0pO1xuXHR9KTtcblxuXHRyZXR1cm4gZWxbbWV0aG9kXS5jYWxsKGVsLCBzZWxlY3Rvcik7XG59XG5cbi8vIEBjcmVkaXRzOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQ4MTcwMjkvd2hhdHMtdGhlLWJlc3Qtd2F5LXRvLWRldGVjdC1hLXRvdWNoLXNjcmVlbi1kZXZpY2UtdXNpbmctamF2YXNjcmlwdC80ODE5ODg2IzQ4MTk4ODZcbnZhciBpc1RvdWNoRGV2aWNlID0gJ29udG91Y2hzdGFydCcgaW4gcm9vdCAvLyB3b3JrcyBvbiBtb3N0IGJyb3dzZXJzXG5cdFx0XHRcdFx0XHRcdFx0IHx8ICdvbm1zZ2VzdHVyZWNoYW5nZScgaW4gcm9vdDsgLy8gd29ya3Mgb24gaWUxMCBvbiBtcyBzdXJmYWNlXG5cbi8vIGxvb2sgOjpoYW5kbGVEcmFnU3RhcnRcbi8vZnVuY3Rpb24gaXNNdWx0aVRvdWNoKGUpIHtcbi8vICByZXR1cm4gZS50b3VjaGVzICYmIEFycmF5LmlzQXJyYXkoZS50b3VjaGVzKSAmJiBlLnRvdWNoZXMubGVuZ3RoID4gMVxuLy99XG5cbi8qKlxuICogc2ltcGxlIGFic3RyYWN0aW9uIGZvciBkcmFnZ2luZyBldmVudHMgbmFtZXNcbiAqICovXG52YXIgZHJhZ0V2ZW50Rm9yID0gKGZ1bmN0aW9uICgpIHtcblx0dmFyIGV2ZW50c0ZvciA9IHtcblx0XHR0b3VjaDoge1xuXHRcdFx0c3RhcnQ6ICd0b3VjaHN0YXJ0Jyxcblx0XHRcdG1vdmU6ICd0b3VjaG1vdmUnLFxuXHRcdFx0ZW5kOiAndG91Y2hlbmQnXG5cdFx0fSxcblx0XHRtb3VzZToge1xuXHRcdFx0c3RhcnQ6ICdtb3VzZWRvd24nLFxuXHRcdFx0bW92ZTogJ21vdXNlbW92ZScsXG5cdFx0XHRlbmQ6ICdtb3VzZXVwJ1xuXHRcdH1cblx0fTtcblx0cmV0dXJuIGV2ZW50c0Zvcltpc1RvdWNoRGV2aWNlID8gJ3RvdWNoJyA6ICdtb3VzZSddO1xufSkoKTtcblxuLyoqXG4gKiBnZXQge2NsaWVudFgsIGNsaWVudFl9IHBvc2l0aW9ucyBvZiBjb250cm9sXG4gKiAqL1xuZnVuY3Rpb24gZ2V0Q29udHJvbFBvc2l0aW9uKGUpIHtcblx0dmFyIHBvc2l0aW9uID0gKGUudG91Y2hlcyAmJiBlLnRvdWNoZXNbMF0pIHx8IGU7XG5cdHJldHVybiB7XG5cdFx0Y2xpZW50WDogcG9zaXRpb24uY2xpZW50WCxcblx0XHRjbGllbnRZOiBwb3NpdGlvbi5jbGllbnRZXG5cdH1cbn1cblxuZnVuY3Rpb24gYWRkRXZlbnQoZWwsIGV2ZW50LCBoYW5kbGVyKSB7XG5cdGlmICghZWwpIHsgcmV0dXJuOyB9XG5cdGlmIChlbC5hdHRhY2hFdmVudCkge1xuXHRcdGVsLmF0dGFjaEV2ZW50KCdvbicgKyBldmVudCwgaGFuZGxlcik7XG5cdH0gZWxzZSBpZiAoZWwuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHRcdGVsLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIHRydWUpO1xuXHR9IGVsc2Uge1xuXHRcdGVsWydvbicgKyBldmVudF0gPSBoYW5kbGVyO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUV2ZW50KGVsLCBldmVudCwgaGFuZGxlcikge1xuXHRpZiAoIWVsKSB7IHJldHVybjsgfVxuXHRpZiAoZWwuZGV0YWNoRXZlbnQpIHtcblx0XHRlbC5kZXRhY2hFdmVudCgnb24nICsgZXZlbnQsIGhhbmRsZXIpO1xuXHR9IGVsc2UgaWYgKGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIpIHtcblx0XHRlbC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyLCB0cnVlKTtcblx0fSBlbHNlIHtcblx0XHRlbFsnb24nICsgZXZlbnRdID0gbnVsbDtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblx0ZGlzcGxheU5hbWU6ICdEcmFnZ2FibGUnLFxuXHRtaXhpbnM6IFtSZWFjdC5hZGRvbnMuUHVyZVJlbmRlck1peGluXSxcblxuXHRwcm9wVHlwZXM6IHtcblx0XHQvKipcblx0XHQgKiBgYXhpc2AgZGV0ZXJtaW5lcyB3aGljaCBheGlzIHRoZSBkcmFnZ2FibGUgY2FuIG1vdmUuXG5cdFx0ICpcblx0XHQgKiAnYm90aCcgYWxsb3dzIG1vdmVtZW50IGhvcml6b250YWxseSBhbmQgdmVydGljYWxseS5cblx0XHQgKiAneCcgbGltaXRzIG1vdmVtZW50IHRvIGhvcml6b250YWwgYXhpcy5cblx0XHQgKiAneScgbGltaXRzIG1vdmVtZW50IHRvIHZlcnRpY2FsIGF4aXMuXG5cdFx0ICpcblx0XHQgKiBEZWZhdWx0cyB0byAnYm90aCcuXG5cdFx0ICovXG5cdFx0YXhpczogUmVhY3QuUHJvcFR5cGVzLm9uZU9mKFsnYm90aCcsICd4JywgJ3knXSksXG5cblx0XHQvKipcblx0XHQgKiBgaGFuZGxlYCBzcGVjaWZpZXMgYSBzZWxlY3RvciB0byBiZSB1c2VkIGFzIHRoZSBoYW5kbGUgdGhhdCBpbml0aWF0ZXMgZHJhZy5cblx0XHQgKlxuXHRcdCAqIEV4YW1wbGU6XG5cdFx0ICpcblx0XHQgKiBgYGBqc3hcblx0XHQgKiBcdHZhciBBcHAgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdFx0ICogXHQgICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG5cdFx0ICogXHQgICAgXHRyZXR1cm4gKFxuXHRcdCAqIFx0ICAgIFx0IFx0PERyYWdnYWJsZSBoYW5kbGU9XCIuaGFuZGxlXCI+XG5cdFx0ICogXHQgICAgXHQgXHQgIDxkaXY+XG5cdFx0ICogXHQgICAgXHQgXHQgICAgICA8ZGl2IGNsYXNzTmFtZT1cImhhbmRsZVwiPkNsaWNrIG1lIHRvIGRyYWc8L2Rpdj5cblx0XHQgKiBcdCAgICBcdCBcdCAgICAgIDxkaXY+VGhpcyBpcyBzb21lIG90aGVyIGNvbnRlbnQ8L2Rpdj5cblx0XHQgKiBcdCAgICBcdCBcdCAgPC9kaXY+XG5cdFx0ICogXHQgICAgXHRcdDwvRHJhZ2dhYmxlPlxuXHRcdCAqIFx0ICAgIFx0KTtcblx0XHQgKiBcdCAgICB9XG5cdFx0ICogXHR9KTtcblx0XHQgKiBgYGBcblx0XHQgKi9cblx0XHRoYW5kbGU6IFJlYWN0LlByb3BUeXBlcy5zdHJpbmcsXG5cblx0XHQvKipcblx0XHQgKiBgY2FuY2VsYCBzcGVjaWZpZXMgYSBzZWxlY3RvciB0byBiZSB1c2VkIHRvIHByZXZlbnQgZHJhZyBpbml0aWFsaXphdGlvbi5cblx0XHQgKlxuXHRcdCAqIEV4YW1wbGU6XG5cdFx0ICpcblx0XHQgKiBgYGBqc3hcblx0XHQgKiBcdHZhciBBcHAgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdFx0ICogXHQgICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG5cdFx0ICogXHQgICAgICAgIHJldHVybihcblx0XHQgKiBcdCAgICAgICAgICAgIDxEcmFnZ2FibGUgY2FuY2VsPVwiLmNhbmNlbFwiPlxuXHRcdCAqIFx0ICAgICAgICAgICAgICAgIDxkaXY+XG5cdFx0ICogXHQgICAgICAgICAgICAgICAgXHQ8ZGl2IGNsYXNzTmFtZT1cImNhbmNlbFwiPllvdSBjYW4ndCBkcmFnIGZyb20gaGVyZTwvZGl2PlxuXHRcdCAqXHRcdFx0XHRcdFx0PGRpdj5EcmFnZ2luZyBoZXJlIHdvcmtzIGZpbmU8L2Rpdj5cblx0XHQgKiBcdCAgICAgICAgICAgICAgICA8L2Rpdj5cblx0XHQgKiBcdCAgICAgICAgICAgIDwvRHJhZ2dhYmxlPlxuXHRcdCAqIFx0ICAgICAgICApO1xuXHRcdCAqIFx0ICAgIH1cblx0XHQgKiBcdH0pO1xuXHRcdCAqIGBgYFxuXHRcdCAqL1xuXHRcdGNhbmNlbDogUmVhY3QuUHJvcFR5cGVzLnN0cmluZyxcblxuXHRcdC8qKlxuXHRcdCAqIGBib3VuZGAgZGV0ZXJtaW5lcyB3aGV0aGVyIHRvIGJvdW5kIHRoZSBtb3ZlbWVudCB0byB0aGUgcGFyZW50IGJveC5cblx0XHQgKlxuXHRcdCAqIFRoZSBwcm9wZXJ0eSB0YWtlcyBhIGxpc3Qgb2Ygc3BhY2Utc2VwYXJhdGVkIHN0cmluZ3MuIFRoZSBEcmFnZ2FibGVcblx0XHQgKiBpcyBib3VuZGVkIGJ5IHRoZSBuZWFyZXN0IERPTU5vZGUub2Zmc2V0UGFyZW50LiBUbyBzZXQgdGhlIG9mZnNldFxuXHRcdCAqIHBhcmVudCwgZ2l2ZSBpdCBhIHBvc2l0aW9uIHZhbHVlIG90aGVyIHRoYW4gJ3N0YXRpYycuXG5cdFx0ICpcblx0XHQgKiBPcHRpb25hbGx5IGNob29zZSBvbmUgb3IgbW9yZSBib3VuZHMgZnJvbTpcblx0XHQgKiAndG9wJyBib3VuZHMgbW92ZW1lbnQgdG8gdGhlIHRvcCBlZGdlIG9mIHRoZSBwYXJlbnQgYm94LlxuXHRcdCAqICdyaWdodCcgYm91bmRzIG1vdmVtZW50IHRvIHRoZSByaWdodCBlZGdlIG9mIHRoZSBwYXJlbnQgYm94LlxuXHRcdCAqICdib3R0b20nIGJvdW5kcyBtb3ZlbWVudCB0byB0aGUgYm90dG9tIGVkZ2Ugb2YgdGhlIHBhcmVudCBib3guXG5cdFx0ICogJ2xlZnQnIGJvdW5kcyBtb3ZlbWVudCB0byB0aGUgbGVmdCBlZGdlIG9mIHRoZSBwYXJlbnQgYm94LlxuXHRcdCAqICdhbGwnIGJvdW5kcyBtb3ZlbWVudCB0byBhbGwgZWRnZXMgKGRlZmF1bHQgaWYgbm90IHNwZWNpZmllZCkuXG5cdFx0ICpcblx0XHQgKiBPcHRpb25hbGx5IGNob29zZSBvbmUgYW5jaG9yIGZyb206XG5cdFx0ICogJ3BvaW50JyB0byBjb25zdHJhaW4gb25seSB0aGUgdG9wLWxlZnQgY29ybmVyLlxuXHRcdCAqICdib3gnIHRvIGNvbnN0cmFpbiB0aGUgZW50aXJlIGJveCAoZGVmYXVsdCBpZiBub3Qgc3BlY2lmaWVkKS5cblx0XHQgKlxuXHRcdCAqIFlvdSBtYXkgdXNlIG1vcmUgdGhhbiBvbmUgYm91bmQsIGUuZy4gJ3RvcCBsZWZ0IHBvaW50Jy4gU2V0IHRvIGFcblx0XHQgKiBmYWxzeSB2YWx1ZSB0byBkaXNhYmxlLlxuXHRcdCAqXG5cdFx0ICogRGVmYXVsdHMgdG8gJ2FsbCBib3gnLlxuXHRcdCAqL1xuXHRcdGJvdW5kOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLFxuXG5cdFx0LyoqXG5cdFx0ICogYGdyaWRgIHNwZWNpZmllcyB0aGUgeCBhbmQgeSB0aGF0IGRyYWdnaW5nIHNob3VsZCBzbmFwIHRvLlxuXHRcdCAqXG5cdFx0ICogRXhhbXBsZTpcblx0XHQgKlxuXHRcdCAqIGBgYGpzeFxuXHRcdCAqICAgdmFyIEFwcCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblx0XHQgKiAgICAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcblx0XHQgKiAgICAgICAgICAgcmV0dXJuIChcblx0XHQgKiBcdCAgICAgICAgICAgIDxEcmFnZ2FibGUgZ3JpZD17WzI1LCAyNV19PlxuXHRcdCAqICAgICAgICAgICAgICAgICAgIDxkaXY+SSBzbmFwIHRvIGEgMjUgeCAyNSBncmlkPC9kaXY+XG5cdFx0ICogICAgICAgICAgICAgICA8L0RyYWdnYWJsZT5cblx0XHQgKiAgICAgICAgICAgKTtcblx0XHQgKiBcdCAgICB9XG5cdFx0ICogICB9KTtcblx0XHQgKiBgYGBcblx0XHQgKi9cblx0XHRncmlkOiBSZWFjdC5Qcm9wVHlwZXMuYXJyYXlPZihSZWFjdC5Qcm9wVHlwZXMubnVtYmVyKSxcblxuXHRcdC8qKlxuXHRcdCAqIGBjb25zdHJhaW5gIHRha2VzIGEgZnVuY3Rpb24gdG8gY29uc3RyYWluIHRoZSBkcmFnZ2luZy5cblx0XHQgKlxuXHRcdCAqIEV4YW1wbGU6XG5cdFx0ICpcblx0XHQgKiBgYGBqc3hcblx0XHQgKiAgIGZ1bmN0aW9uIGNvbnN0cmFpbiAoc25hcCkge1xuXHRcdCAqICAgICAgICAgZnVuY3Rpb24gY29uc3RyYWluT2Zmc2V0IChvZmZzZXQsIHByZXYpIHtcblx0XHQgKiAgICAgICAgICAgICAgIHZhciBkZWx0YSA9IG9mZnNldCAtIHByZXY7XG5cdFx0ICogICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMoZGVsdGEpID49IHNuYXApIHtcblx0XHQgKiAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmV2ICsgKGRlbHRhIDwgMCA/IC1zbmFwIDogc25hcCk7XG5cdFx0ICogICAgICAgICAgICAgICB9XG5cdFx0ICogICAgICAgICAgICAgICByZXR1cm4gcHJldjtcblx0XHQgKiAgICAgICAgIH1cblx0XHQgKiAgICAgICAgIHJldHVybiBmdW5jdGlvbiAocG9zKSB7XG5cdFx0ICogICAgICAgICAgICAgICByZXR1cm4ge1xuXHRcdCAqICAgICAgICAgICAgICAgICAgICAgdG9wOiBjb25zdHJhaW5PZmZzZXQocG9zLnRvcCwgcG9zLnByZXZUb3ApLFxuXHRcdCAqICAgICAgICAgICAgICAgICAgICAgbGVmdDogY29uc3RyYWluT2Zmc2V0KHBvcy5sZWZ0LCBwb3MucHJldkxlZnQpXG5cdFx0ICogICAgICAgICAgICAgICB9O1xuXHRcdCAqICAgICAgICAgfTtcblx0XHQgKiAgIH1cblx0XHQgKiAgIHZhciBBcHAgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdFx0ICogICAgICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG5cdFx0ICogICAgICAgICAgIHJldHVybiAoXG5cdFx0ICogICAgICAgICAgICAgICA8RHJhZ2dhYmxlIGNvbnN0cmFpbj17Y29uc3RyYWlufT5cblx0XHQgKiAgICAgICAgICAgICAgICAgICA8ZGl2Pkkgc25hcCB0byBhIDI1IHggMjUgZ3JpZDwvZGl2PlxuXHRcdCAqICAgICAgICAgICAgICAgPC9EcmFnZ2FibGU+XG5cdFx0ICogICAgICAgICAgICk7XG5cdFx0ICogICAgICAgfVxuXHRcdCAqICAgfSk7XG5cdFx0ICogYGBgXG5cdFx0ICovXG5cdFx0Y29uc3RyYWluOiBSZWFjdC5Qcm9wVHlwZXMuZnVuYyxcblxuXHRcdC8qKlxuXHRcdCAqIGBzdGFydGAgc3BlY2lmaWVzIHRoZSB4IGFuZCB5IHRoYXQgdGhlIGRyYWdnZWQgaXRlbSBzaG91bGQgc3RhcnQgYXRcblx0XHQgKlxuXHRcdCAqIEV4YW1wbGU6XG5cdFx0ICpcblx0XHQgKiBgYGBqc3hcblx0XHQgKiBcdHZhciBBcHAgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdFx0ICogXHQgICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG5cdFx0ICogXHQgICAgICAgIHJldHVybiAoXG5cdFx0ICogXHQgICAgICAgICAgICA8RHJhZ2dhYmxlIHN0YXJ0PXt7eDogMjUsIHk6IDI1fX0+XG5cdFx0ICogXHQgICAgICAgICAgICAgICAgPGRpdj5JIHN0YXJ0IHdpdGggbGVmdDogMjVweDsgdG9wOiAyNXB4OzwvZGl2PlxuXHRcdCAqIFx0ICAgICAgICAgICAgPC9EcmFnZ2FibGU+XG5cdFx0ICogXHQgICAgICAgICk7XG5cdFx0ICogXHQgICAgfVxuXHRcdCAqIFx0fSk7XG5cdFx0ICogYGBgXG5cdFx0ICovXG5cdFx0c3RhcnQ6IFJlYWN0LlByb3BUeXBlcy5vYmplY3QsXG5cblx0XHQvKipcblx0XHQgKiBgekluZGV4YCBzcGVjaWZpZXMgdGhlIHpJbmRleCB0byB1c2Ugd2hpbGUgZHJhZ2dpbmcuXG5cdFx0ICpcblx0XHQgKiBFeGFtcGxlOlxuXHRcdCAqXG5cdFx0ICogYGBganN4XG5cdFx0ICogXHR2YXIgQXBwID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXHRcdCAqIFx0ICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuXHRcdCAqIFx0ICAgICAgICByZXR1cm4gKFxuXHRcdCAqIFx0ICAgICAgICAgICAgPERyYWdnYWJsZSB6SW5kZXg9ezEwMH0+XG5cdFx0ICogXHQgICAgICAgICAgICAgICAgPGRpdj5JIGhhdmUgYSB6SW5kZXg8L2Rpdj5cblx0XHQgKiBcdCAgICAgICAgICAgIDwvRHJhZ2dhYmxlPlxuXHRcdCAqIFx0ICAgICAgICApO1xuXHRcdCAqIFx0ICAgIH1cblx0XHQgKiBcdH0pO1xuXHRcdCAqIGBgYFxuXHRcdCAqL1xuXHRcdHpJbmRleDogUmVhY3QuUHJvcFR5cGVzLm51bWJlcixcblxuXHRcdC8qKlxuXHRcdCAqIGB1c2VDaGlsZGAgZGV0ZXJtaW5lcyB3aGV0aGVyIHRvIHVzZSB0aGUgZmlyc3QgY2hpbGQgYXMgcm9vdC5cblx0XHQgKlxuXHRcdCAqIElmIGZhbHNlLCBhIGRpdiBpcyBjcmVhdGVkLiBUaGlzIG9wdGlvbiBpcyByZXF1aXJlZCBpZiBhbnkgY2hpbGRyZW5cblx0XHQgKiBoYXZlIGEgcmVmLlxuXHRcdCAqXG5cdFx0ICogRGVmYXVsdHMgdG8gdHJ1ZS5cblx0XHQgKi9cblx0XHR1c2VDaGlsZDogUmVhY3QuUHJvcFR5cGVzLmJvb2wsXG5cblx0XHQvKipcblx0XHQgKiBDYWxsZWQgd2hlbiBkcmFnZ2luZyBzdGFydHMuXG5cdFx0ICpcblx0XHQgKiBFeGFtcGxlOlxuXHRcdCAqXG5cdFx0ICogYGBganNcblx0XHQgKlx0ZnVuY3Rpb24gKGV2ZW50LCB1aSkge31cblx0XHQgKiBgYGBcblx0XHQgKlxuXHRcdCAqIGBldmVudGAgaXMgdGhlIEV2ZW50IHRoYXQgd2FzIHRyaWdnZXJlZC5cblx0XHQgKiBgdWlgIGlzIGFuIG9iamVjdDpcblx0XHQgKlxuXHRcdCAqIGBgYGpzXG5cdFx0ICpcdHtcblx0XHQgKlx0XHRwb3NpdGlvbjoge3RvcDogMCwgbGVmdDogMH1cblx0XHQgKlx0fVxuXHRcdCAqIGBgYFxuXHRcdCAqL1xuXHRcdG9uU3RhcnQ6IFJlYWN0LlByb3BUeXBlcy5mdW5jLFxuXG5cdFx0LyoqXG5cdFx0ICogQ2FsbGVkIHdoaWxlIGRyYWdnaW5nLlxuXHRcdCAqXG5cdFx0ICogRXhhbXBsZTpcblx0XHQgKlxuXHRcdCAqIGBgYGpzXG5cdFx0ICpcdGZ1bmN0aW9uIChldmVudCwgdWkpIHt9XG5cdFx0ICogYGBgXG5cdFx0ICpcblx0XHQgKiBgZXZlbnRgIGlzIHRoZSBFdmVudCB0aGF0IHdhcyB0cmlnZ2VyZWQuXG5cdFx0ICogYHVpYCBpcyBhbiBvYmplY3Q6XG5cdFx0ICpcblx0XHQgKiBgYGBqc1xuXHRcdCAqXHR7XG5cdFx0ICpcdFx0cG9zaXRpb246IHt0b3A6IDAsIGxlZnQ6IDB9XG5cdFx0ICpcdH1cblx0XHQgKiBgYGBcblx0XHQgKi9cblx0XHRvbkRyYWc6IFJlYWN0LlByb3BUeXBlcy5mdW5jLFxuXG5cdFx0LyoqXG5cdFx0ICogQ2FsbGVkIHdoZW4gZHJhZ2dpbmcgc3RvcHMuXG5cdFx0ICpcblx0XHQgKiBFeGFtcGxlOlxuXHRcdCAqXG5cdFx0ICogYGBganNcblx0XHQgKlx0ZnVuY3Rpb24gKGV2ZW50LCB1aSkge31cblx0XHQgKiBgYGBcblx0XHQgKlxuXHRcdCAqIGBldmVudGAgaXMgdGhlIEV2ZW50IHRoYXQgd2FzIHRyaWdnZXJlZC5cblx0XHQgKiBgdWlgIGlzIGFuIG9iamVjdDpcblx0XHQgKlxuXHRcdCAqIGBgYGpzXG5cdFx0ICpcdHtcblx0XHQgKlx0XHRwb3NpdGlvbjoge3RvcDogMCwgbGVmdDogMH1cblx0XHQgKlx0fVxuXHRcdCAqIGBgYFxuXHRcdCAqL1xuXHRcdG9uU3RvcDogUmVhY3QuUHJvcFR5cGVzLmZ1bmMsXG5cblx0XHQvKipcblx0XHQgKiBBIHdvcmthcm91bmQgb3B0aW9uIHdoaWNoIGNhbiBiZSBwYXNzZWQgaWYgb25Nb3VzZURvd24gbmVlZHMgdG8gYmUgYWNjZXNzZWQsIHNpbmNlIGl0J2xsIGFsd2F5cyBiZSBibG9ja2VkIChkdWUgdG8gdGhhdCB0aGVyZSdzIGludGVybmFsIHVzZSBvZiBvbk1vdXNlRG93bilcblx0XHQgKlxuXHRcdCAqL1xuXHRcdG9uTW91c2VEb3duOiBSZWFjdC5Qcm9wVHlwZXMuZnVuY1xuXHR9LFxuXG5cdGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRheGlzOiAnYm90aCcsXG5cdFx0XHRib3VuZDogbnVsbCxcblx0XHRcdGhhbmRsZTogbnVsbCxcblx0XHRcdGNhbmNlbDogbnVsbCxcblx0XHRcdGdyaWQ6IG51bGwsXG5cdFx0XHRzdGFydDoge30sXG5cdFx0XHR6SW5kZXg6IE5hTixcblx0XHRcdHVzZUNoaWxkOiB0cnVlLFxuXHRcdFx0b25TdGFydDogZW1wdHlGdW5jdGlvbixcblx0XHRcdG9uRHJhZzogZW1wdHlGdW5jdGlvbixcblx0XHRcdG9uU3RvcDogZW1wdHlGdW5jdGlvbixcblx0XHRcdG9uTW91c2VEb3duOiBlbXB0eUZ1bmN0aW9uXG5cdFx0fTtcblx0fSxcblxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgc3RhdGUgPSB7XG5cdFx0XHQvLyBXaGV0aGVyIG9yIG5vdCBjdXJyZW50bHkgZHJhZ2dpbmdcblx0XHRcdGRyYWdnaW5nOiBmYWxzZSxcblxuXHRcdFx0Ly8gUG9pbnRlciBvZmZzZXQgb24gc2NyZWVuXG5cdFx0XHRjbGllbnRYOiAwLCBjbGllbnRZOiAwLFxuXG5cdFx0XHQvLyBET01Ob2RlIG9mZnNldCByZWxhdGl2ZSB0byBwYXJlbnRcblx0XHRcdG9mZnNldExlZnQ6IHRoaXMucHJvcHMuc3RhcnQueCB8fCAwLCBvZmZzZXRUb3A6IHRoaXMucHJvcHMuc3RhcnQueSB8fCAwXG5cdFx0fTtcblxuXHRcdHVwZGF0ZUJvdW5kU3RhdGUoc3RhdGUsIHRoaXMucHJvcHMuYm91bmQpO1xuXG5cdFx0cmV0dXJuIHN0YXRlO1xuXHR9LFxuXG5cdGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHM6IGZ1bmN0aW9uIChuZXh0UHJvcHMpIHtcblx0XHR2YXIgc3RhdGUgPSB1cGRhdGVCb3VuZFN0YXRlKHt9LCBuZXh0UHJvcHMuYm91bmQpO1xuXHRcdGlmIChuZXh0UHJvcHMuc3RhcnQpIHtcblx0XHRcdGlmIChuZXh0UHJvcHMuc3RhcnQueCAhPSBudWxsKSB7XG5cdFx0XHRcdHN0YXRlLm9mZnNldExlZnQgPSBuZXh0UHJvcHMuc3RhcnQueCB8fCAwO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG5leHRQcm9wcy5zdGFydC55ICE9IG51bGwpIHtcblx0XHRcdFx0c3RhdGUub2Zmc2V0VG9wID0gbmV4dFByb3BzLnN0YXJ0LnkgfHwgMDtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5zZXRTdGF0ZShzdGF0ZSk7XG5cdH0sXG5cblx0Y29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uKCkge1xuXHRcdC8vIFJlbW92ZSBhbnkgbGVmdG92ZXIgZXZlbnQgaGFuZGxlcnNcblx0XHRyZW1vdmVFdmVudChyb290LCBkcmFnRXZlbnRGb3JbJ21vdmUnXSwgdGhpcy5oYW5kbGVEcmFnKTtcblx0XHRyZW1vdmVFdmVudChyb290LCBkcmFnRXZlbnRGb3JbJ2VuZCddLCB0aGlzLmhhbmRsZURyYWdFbmQpO1xuXHR9LFxuXG5cdGhhbmRsZURyYWdTdGFydDogZnVuY3Rpb24gKGUpIHtcblx0XHQvLyB0b2RvOiB3cml0ZSByaWdodCBpbXBsZW1lbnRhdGlvbiB0byBwcmV2ZW50IG11bHRpdG91Y2ggZHJhZ1xuXHRcdC8vIHByZXZlbnQgbXVsdGktdG91Y2ggZXZlbnRzXG5cdFx0Ly8gaWYgKGlzTXVsdGlUb3VjaChlKSkge1xuXHRcdC8vICAgICB0aGlzLmhhbmRsZURyYWdFbmQuYXBwbHkoZSwgYXJndW1lbnRzKTtcblx0XHQvLyAgICAgcmV0dXJuXG5cdFx0Ly8gfVxuXG5cdFx0Ly8gTWFrZSBpdCBwb3NzaWJsZSB0byBhdHRhY2ggZXZlbnQgaGFuZGxlcnMgb24gdG9wIG9mIHRoaXMgb25lXG5cdFx0dGhpcy5wcm9wcy5vbk1vdXNlRG93bihlKTtcblxuXHRcdC8vIFNob3J0IGNpcmN1aXQgaWYgaGFuZGxlIG9yIGNhbmNlbCBwcm9wIHdhcyBwcm92aWRlZCBhbmQgc2VsZWN0b3IgZG9lc24ndCBtYXRjaFxuXHRcdGlmICgodGhpcy5wcm9wcy5oYW5kbGUgJiYgIW1hdGNoZXNTZWxlY3RvcihlLnRhcmdldCwgdGhpcy5wcm9wcy5oYW5kbGUpKSB8fFxuXHRcdFx0KHRoaXMucHJvcHMuY2FuY2VsICYmIG1hdGNoZXNTZWxlY3RvcihlLnRhcmdldCwgdGhpcy5wcm9wcy5jYW5jZWwpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZhciBkcmFnUG9pbnQgPSBnZXRDb250cm9sUG9zaXRpb24oZSk7XG5cblx0XHQvLyBJbml0aWF0ZSBkcmFnZ2luZ1xuXHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0ZHJhZ2dpbmc6IHRydWUsXG5cdFx0XHRjbGllbnRYOiBkcmFnUG9pbnQuY2xpZW50WCxcblx0XHRcdGNsaWVudFk6IGRyYWdQb2ludC5jbGllbnRZXG5cdFx0fSk7XG5cblx0XHQvLyBDYWxsIGV2ZW50IGhhbmRsZXJcblx0XHR0aGlzLnByb3BzLm9uU3RhcnQoZSwgY3JlYXRlVUlFdmVudCh0aGlzKSk7XG5cblx0XHQvLyBBZGQgZXZlbnQgaGFuZGxlcnNcblx0XHRhZGRFdmVudChyb290LCBkcmFnRXZlbnRGb3JbJ21vdmUnXSwgdGhpcy5oYW5kbGVEcmFnKTtcblx0XHRhZGRFdmVudChyb290LCBkcmFnRXZlbnRGb3JbJ2VuZCddLCB0aGlzLmhhbmRsZURyYWdFbmQpO1xuXG5cdFx0Ly8gQWRkIGRyYWdnaW5nIGNsYXNzIHRvIGJvZHkgZWxlbWVudFxuXHRcdGlmIChib2R5RWxlbWVudCkgYm9keUVsZW1lbnQuY2xhc3NOYW1lICs9ICcgcmVhY3QtZHJhZ2dhYmxlLWRyYWdnaW5nJztcblx0fSxcblxuXHRoYW5kbGVEcmFnRW5kOiBmdW5jdGlvbiAoZSkge1xuXHRcdC8vIFNob3J0IGNpcmN1aXQgaWYgbm90IGN1cnJlbnRseSBkcmFnZ2luZ1xuXHRcdGlmICghdGhpcy5zdGF0ZS5kcmFnZ2luZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFR1cm4gb2ZmIGRyYWdnaW5nXG5cdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRkcmFnZ2luZzogZmFsc2Vcblx0XHR9KTtcblxuXHRcdC8vIENhbGwgZXZlbnQgaGFuZGxlclxuXHRcdHRoaXMucHJvcHMub25TdG9wKGUsIGNyZWF0ZVVJRXZlbnQodGhpcykpO1xuXG5cdFx0Ly8gUmVtb3ZlIGV2ZW50IGhhbmRsZXJzXG5cdFx0cmVtb3ZlRXZlbnQocm9vdCwgZHJhZ0V2ZW50Rm9yWydtb3ZlJ10sIHRoaXMuaGFuZGxlRHJhZyk7XG5cdFx0cmVtb3ZlRXZlbnQocm9vdCwgZHJhZ0V2ZW50Rm9yWydlbmQnXSwgdGhpcy5oYW5kbGVEcmFnRW5kKTtcblxuXHRcdC8vIFJlbW92ZSBkcmFnZ2luZyBjbGFzcyBmcm9tIGJvZHkgZWxlbWVudFxuXHRcdGlmIChib2R5RWxlbWVudCkge1xuXHRcdFx0dmFyIGNsYXNzTmFtZSA9IGJvZHlFbGVtZW50LmNsYXNzTmFtZTtcblx0XHRcdGJvZHlFbGVtZW50LmNsYXNzTmFtZSA9XG5cdFx0XHRcdGNsYXNzTmFtZS5yZXBsYWNlKC8oPzpefFxccyspcmVhY3QtZHJhZ2dhYmxlLWRyYWdnaW5nXFxiLywgJyAnKTtcblx0XHR9XG5cdH0sXG5cblx0aGFuZGxlRHJhZzogZnVuY3Rpb24gKGUpIHtcblx0XHR2YXIgZHJhZ1BvaW50ID0gZ2V0Q29udHJvbFBvc2l0aW9uKGUpO1xuXHRcdHZhciBvZmZzZXRMZWZ0ID0gdGhpcy5fdG9QaXhlbHModGhpcy5zdGF0ZS5vZmZzZXRMZWZ0KTtcblx0XHR2YXIgb2Zmc2V0VG9wID0gdGhpcy5fdG9QaXhlbHModGhpcy5zdGF0ZS5vZmZzZXRUb3ApO1xuXG5cdFx0dmFyIHN0YXRlID0ge1xuXHRcdFx0b2Zmc2V0TGVmdDogb2Zmc2V0TGVmdCxcblx0XHRcdG9mZnNldFRvcDogb2Zmc2V0VG9wXG5cdFx0fTtcblxuXHRcdC8vIEdldCBwYXJlbnQgRE9NIG5vZGVcblx0XHR2YXIgbm9kZSA9IHRoaXMuZ2V0RE9NTm9kZSgpO1xuXHRcdHZhciBvZmZzZXRQYXJlbnQgPSBub2RlLm9mZnNldFBhcmVudDtcblx0XHR2YXIgb2Zmc2V0LCBib3VuZGluZ1ZhbHVlO1xuXG5cdFx0aWYgKGNhbkRyYWdYKHRoaXMpKSB7XG5cdFx0XHQvLyBDYWxjdWxhdGUgdXBkYXRlZCBwb3NpdGlvblxuXHRcdFx0b2Zmc2V0ID0gb2Zmc2V0TGVmdCArIGRyYWdQb2ludC5jbGllbnRYIC0gdGhpcy5zdGF0ZS5jbGllbnRYO1xuXG5cdFx0XHQvLyBCb3VuZCBtb3ZlbWVudCB0byBwYXJlbnQgYm94XG5cdFx0XHRpZiAodGhpcy5zdGF0ZS5ib3VuZExlZnQpIHtcblx0XHRcdFx0Ym91bmRpbmdWYWx1ZSA9IHN0YXRlLm9mZnNldExlZnQgLSBub2RlLm9mZnNldExlZnQ7XG5cdFx0XHRcdGlmIChvZmZzZXQgPCBib3VuZGluZ1ZhbHVlKSB7XG5cdFx0XHRcdFx0b2Zmc2V0ID0gYm91bmRpbmdWYWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuc3RhdGUuYm91bmRSaWdodCkge1xuXHRcdFx0XHRib3VuZGluZ1ZhbHVlICs9IG9mZnNldFBhcmVudC5jbGllbnRXaWR0aDtcblx0XHRcdFx0aWYgKHRoaXMuc3RhdGUuYm91bmRCb3gpIHtcblx0XHRcdFx0XHRib3VuZGluZ1ZhbHVlIC09IG5vZGUub2Zmc2V0V2lkdGg7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9mZnNldCA+IGJvdW5kaW5nVmFsdWUpIHtcblx0XHRcdFx0XHRvZmZzZXQgPSBib3VuZGluZ1ZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBVcGRhdGUgbGVmdFxuXHRcdFx0c3RhdGUub2Zmc2V0TGVmdCA9IG9mZnNldDtcblx0XHR9XG5cblx0XHRpZiAoY2FuRHJhZ1kodGhpcykpIHtcblx0XHRcdC8vIENhbGN1bGF0ZSB1cGRhdGVkIHBvc2l0aW9uXG5cdFx0XHRvZmZzZXQgPSBvZmZzZXRUb3AgKyBkcmFnUG9pbnQuY2xpZW50WSAtIHRoaXMuc3RhdGUuY2xpZW50WTtcblx0XHRcdC8vIEJvdW5kIG1vdmVtZW50IHRvIHBhcmVudCBib3hcblx0XHRcdGlmICh0aGlzLnN0YXRlLmJvdW5kVG9wKSB7XG5cdFx0XHRcdGJvdW5kaW5nVmFsdWUgPSBzdGF0ZS5vZmZzZXRUb3AgLSBub2RlLm9mZnNldFRvcDtcblx0XHRcdFx0aWYgKG9mZnNldCA8IGJvdW5kaW5nVmFsdWUpIHtcblx0XHRcdFx0XHRvZmZzZXQgPSBib3VuZGluZ1ZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5zdGF0ZS5ib3VuZEJvdHRvbSkge1xuXHRcdFx0XHRib3VuZGluZ1ZhbHVlICs9IG9mZnNldFBhcmVudC5jbGllbnRIZWlnaHQ7XG5cdFx0XHRcdGlmICh0aGlzLnN0YXRlLmJvdW5kQm94KSB7XG5cdFx0XHRcdFx0Ym91bmRpbmdWYWx1ZSAtPSBub2RlLm9mZnNldEhlaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob2Zmc2V0ID4gYm91bmRpbmdWYWx1ZSkge1xuXHRcdFx0XHRcdG9mZnNldCA9IGJvdW5kaW5nVmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIFVwZGF0ZSB0b3Bcblx0XHRcdHN0YXRlLm9mZnNldFRvcCA9IG9mZnNldDtcblx0XHR9XG5cblx0XHR2YXIgY29uc3RyYWluID0gdGhpcy5wcm9wcy5jb25zdHJhaW47XG5cdFx0dmFyIGdyaWQgPSB0aGlzLnByb3BzLmdyaWQ7XG5cblx0XHQvLyBCYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3Igc25hcCB0byBncmlkXG5cdFx0aWYgKCFjb25zdHJhaW4gJiYgQXJyYXkuaXNBcnJheShncmlkKSkge1xuXHRcdFx0dmFyIGNvbnN0cmFpbk9mZnNldCA9IGZ1bmN0aW9uIChvZmZzZXQsIHByZXYsIHNuYXApIHtcblx0XHRcdFx0dmFyIGRlbHRhID0gb2Zmc2V0IC0gcHJldjtcblx0XHRcdFx0aWYgKE1hdGguYWJzKGRlbHRhKSA+PSBzbmFwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHByZXYgKyBwYXJzZUludChkZWx0YSAvIHNuYXAsIDEwKSAqIHNuYXA7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHByZXY7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3RyYWluID0gZnVuY3Rpb24gKHBvcykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGxlZnQ6IGNvbnN0cmFpbk9mZnNldChwb3MubGVmdCwgcG9zLnByZXZMZWZ0LCBncmlkWzBdKSxcblx0XHRcdFx0XHR0b3A6IGNvbnN0cmFpbk9mZnNldChwb3MudG9wLCBwb3MucHJldlRvcCwgZ3JpZFsxXSlcblx0XHRcdFx0fTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gQ29uc3RyYWluIGlmIGZ1bmN0aW9uIGhhcyBiZWVuIHByb3ZpZGVkXG5cdFx0dmFyIHBvc2l0aW9ucztcblx0XHRpZiAoY29uc3RyYWluKSB7XG5cdFx0XHQvLyBDb25zdHJhaW4gcG9zaXRpb25zXG5cdFx0XHRwb3NpdGlvbnMgPSBjb25zdHJhaW4oe1xuXHRcdFx0XHRwcmV2TGVmdDogdGhpcy5zdGF0ZS5vZmZzZXRMZWZ0LFxuXHRcdFx0XHRwcmV2VG9wOiB0aGlzLnN0YXRlLm9mZnNldFRvcCxcblx0XHRcdFx0bGVmdDogc3RhdGUub2Zmc2V0TGVmdCxcblx0XHRcdFx0dG9wOiBzdGF0ZS5vZmZzZXRUb3Bcblx0XHRcdH0pO1xuXHRcdFx0aWYgKHBvc2l0aW9ucykge1xuXHRcdFx0XHQvLyBVcGRhdGUgbGVmdFxuXHRcdFx0XHRpZiAoJ2xlZnQnIGluIHBvc2l0aW9ucyAmJiAhaXNOYU4ocG9zaXRpb25zLmxlZnQpKSB7XG5cdFx0XHRcdFx0c3RhdGUub2Zmc2V0TGVmdCA9IHBvc2l0aW9ucy5sZWZ0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFVwZGF0ZSB0b3Bcblx0XHRcdFx0aWYgKCd0b3AnIGluIHBvc2l0aW9ucyAmJiAhaXNOYU4ocG9zaXRpb25zLnRvcCkpIHtcblx0XHRcdFx0XHRzdGF0ZS5vZmZzZXRUb3AgPSBwb3NpdGlvbnMudG9wO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU2F2ZSBuZXcgc3RhdGVcblx0XHRzdGF0ZS5jbGllbnRYID0gdGhpcy5zdGF0ZS5jbGllbnRYICsgKHN0YXRlLm9mZnNldExlZnQgLSBvZmZzZXRMZWZ0KTtcblx0XHRzdGF0ZS5jbGllbnRZID0gdGhpcy5zdGF0ZS5jbGllbnRZICsgKHN0YXRlLm9mZnNldFRvcCAtIG9mZnNldFRvcCk7XG5cdFx0dGhpcy5zZXRTdGF0ZShzdGF0ZSk7XG5cblx0XHQvLyBDYWxsIGV2ZW50IGhhbmRsZXJcblx0XHR0aGlzLnByb3BzLm9uRHJhZyhlLCBjcmVhdGVVSUV2ZW50KHRoaXMpKTtcblx0fSxcblxuXHRvblRvdWNoU3RhcnQ6IGZ1bmN0aW9uIChlKSB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBwcmV2ZW50IGZvciBzY3JvbGxcblx0XHRyZXR1cm4gdGhpcy5oYW5kbGVEcmFnU3RhcnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0fSxcblxuXHRyZW5kZXI6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgc3R5bGUgPSB7XG5cdFx0XHR0b3A6IHRoaXMuc3RhdGUub2Zmc2V0VG9wLFxuXHRcdFx0bGVmdDogdGhpcy5zdGF0ZS5vZmZzZXRMZWZ0XG5cdFx0fTtcblxuXHRcdC8vIFNldCB6SW5kZXggaWYgY3VycmVudGx5IGRyYWdnaW5nIGFuZCBwcm9wIGhhcyBiZWVuIHByb3ZpZGVkXG5cdFx0aWYgKHRoaXMuc3RhdGUuZHJhZ2dpbmcgJiYgIWlzTmFOKHRoaXMucHJvcHMuekluZGV4KSkge1xuXHRcdFx0c3R5bGUuekluZGV4ID0gdGhpcy5wcm9wcy56SW5kZXg7XG5cdFx0fVxuXG4gXHRcdHZhciBwcm9wcyA9IHtcbiBcdFx0XHRzdHlsZTogc3R5bGUsXG4gXHRcdFx0Y2xhc3NOYW1lOiAncmVhY3QtZHJhZ2dhYmxlJyxcblxuIFx0XHRcdG9uTW91c2VEb3duOiB0aGlzLmhhbmRsZURyYWdTdGFydCxcbiBcdFx0XHRvblRvdWNoU3RhcnQ6IHRoaXMub25Ub3VjaFN0YXJ0LFxuXG4gXHRcdFx0b25Nb3VzZVVwOiB0aGlzLmhhbmRsZURyYWdFbmQsXG4gXHRcdFx0b25Ub3VjaEVuZDogdGhpcy5oYW5kbGVEcmFnRW5kXG4gXHRcdH07XG5cblx0XHQvLyBSZXVzZSB0aGUgY2hpbGQgcHJvdmlkZWRcblx0XHQvLyBUaGlzIG1ha2VzIGl0IGZsZXhpYmxlIHRvIHVzZSB3aGF0ZXZlciBlbGVtZW50IGlzIHdhbnRlZCAoZGl2LCB1bCwgZXRjKVxuXHRcdGlmICh0aGlzLnByb3BzLnVzZUNoaWxkKSB7XG5cdFx0XHRyZXR1cm4gUmVhY3QuYWRkb25zLmNsb25lV2l0aFByb3BzKFJlYWN0LkNoaWxkcmVuLm9ubHkodGhpcy5wcm9wcy5jaGlsZHJlbiksIHByb3BzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUmVhY3QuRE9NLmRpdihwcm9wcywgdGhpcy5wcm9wcy5jaGlsZHJlbik7XG5cdH0sXG5cblx0X3RvUGl4ZWxzOiBmdW5jdGlvbiAodmFsdWUpIHtcblxuXHRcdC8vIFN1cHBvcnQgcGVyY2VudGFnZXNcblx0XHRpZiAodHlwZW9mIHZhbHVlID09ICdzdHJpbmcnICYmIHZhbHVlLnNsaWNlKC0xKSA9PSAnJScpIHtcblx0XHRcdHJldHVybiBwYXJzZUludCgoK3ZhbHVlLnJlcGxhY2UoJyUnLCAnJykgLyAxMDApICpcblx0XHRcdFx0dGhpcy5nZXRET01Ob2RlKCkub2Zmc2V0UGFyZW50LmNsaWVudFdpZHRoLCAxMCkgfHwgMDtcblx0XHR9XG5cblx0XHQvLyBJbnZhbGlkIHZhbHVlcyBiZWNvbWUgemVyb1xuXHRcdHZhciBpID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcblx0XHRpZiAoaXNOYU4oaSkgfHwgIWlzRmluaXRlKGkpKSByZXR1cm4gMDtcblxuXHRcdHJldHVybiBpO1xuXHR9XG5cbn0pO1xuIl19