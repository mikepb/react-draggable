var React = require('react');
var ReactDOM = require('react-dom');
var TestUtils = require('react-addons-test-utils');
var Draggable = require('../lib/draggable');

describe('react-draggable', function () {
	describe('props', function () {
		it('should have default properties', function () {
			var drag = TestUtils.renderIntoDocument(<Draggable><div/></Draggable>);

			expect(drag.props.axis).toEqual('both');
			expect(drag.props.bound).toEqual(null);
			expect(drag.props.handle).toEqual(null);
			expect(drag.props.cancel).toEqual(null);
			expect(isNaN(drag.props.zIndex)).toEqual(true);
			expect(drag.props.useChild).toEqual(true);
			expect(typeof drag.props.onStart).toEqual('function');
			expect(typeof drag.props.onDrag).toEqual('function');
			expect(typeof drag.props.onStop).toEqual('function');
		});

		it('should honor props', function () {
			function handleStart() {}
			function handleDrag() {}
			function handleStop() {}

			var drag = TestUtils.renderIntoDocument(
				<Draggable
					axis="y"
					bound="true"
					handle=".handle"
					cancel=".cancel"
					grid={[10, 10]}
					zIndex={1000}
					onStart={handleStart}
					onDrag={handleDrag}
					onStop={handleStop}>
					<div>
						<div className="handle"/>
						<div className="cancel"/>
					</div>
				</Draggable>
			);

			expect(drag.props.axis).toEqual('y');
			expect(drag.props.bound).toEqual("true");
			expect(drag.props.handle).toEqual('.handle');
			expect(drag.props.cancel).toEqual('.cancel');
			expect(drag.props.grid).toEqual([10, 10]);
			expect(drag.props.zIndex).toEqual(1000);
			expect(drag.props.onStart).toEqual(handleStart);
			expect(drag.props.onDrag).toEqual(handleDrag);
			expect(drag.props.onStop).toEqual(handleStop);
		});

		it('should honor useChild prop', function () {
			var drag = TestUtils.renderIntoDocument(
				<Draggable useChild={false}/>
			);

			expect(ReactDOM.findDOMNode(drag).nodeName).toEqual('DIV');
		});

		it('should call onStart when dragging begins', function () {
			var called = false;
			var drag = TestUtils.renderIntoDocument(
				<Draggable onStart={function () { called = true; }}>
					<div/>
				</Draggable>
			);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});

		it('should call onStop when dragging ends', function () {
			var called = false;
			var drag = TestUtils.renderIntoDocument(
				<Draggable onStop={function () { called = true; }}>
					<div/>
				</Draggable>
			);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag));
			TestUtils.Simulate.mouseUp(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});

		it('should call onStart when touch dragging begins', function () {
			var called = false;
			var drag = TestUtils.renderIntoDocument(
				<Draggable onStart={function () { called = true; }}>
					<div/>
				</Draggable>
			);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});

		it('should call onStop when touch dragging ends', function () {
			var called = false;
			var drag = TestUtils.renderIntoDocument(
				<Draggable onStop={function () { called = true; }}>
					<div/>
				</Draggable>
			);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag));
			TestUtils.Simulate.touchEnd(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});


		it('should add react-draggable-dragging CSS class to body element when dragging', function () {
			var drag = TestUtils.renderIntoDocument(
				<Draggable>
					<div/>
				</Draggable>
			);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag));
			expect(document.body.className).toMatch(/\breact-draggable-dragging\b/);
			TestUtils.Simulate.mouseUp(ReactDOM.findDOMNode(drag));
		});
	});

	describe('mouse interaction', function () {
		it('should initialize dragging onmousedown', function () {
			var drag = TestUtils.renderIntoDocument(<Draggable><div/></Draggable>);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual('mouse');
		});

		it('should only initialize dragging onmousedown of handle', function () {
			var drag = TestUtils.renderIntoDocument(
				<Draggable handle=".handle">
					<div>
						<div className="handle">Handle</div>
						<div className="content">Lorem ipsum...</div>
					</div>
				</Draggable>
			);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag).querySelector('.content'));
			expect(drag.state.dragging).toEqual(false);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag).querySelector('.handle'));
			expect(drag.state.dragging).toEqual('mouse');
		});

		it('should not initialize dragging onmousedown of cancel', function () {
			var drag = TestUtils.renderIntoDocument(
				<Draggable cancel=".cancel">
					<div>
						<div className="cancel">Cancel</div>
						<div className="content">Lorem ipsum...</div>
					</div>
				</Draggable>
			);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag).querySelector('.cancel'));
			expect(drag.state.dragging).toEqual(false);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag).querySelector('.content'));
			expect(drag.state.dragging).toEqual('mouse');
		});

		it('should discontinue dragging onmouseup', function () {
			var drag = TestUtils.renderIntoDocument(<Draggable><div/></Draggable>);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual('mouse');

			TestUtils.Simulate.mouseUp(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual(false);
		});
	});

	describe('touch interaction', function () {
		it('should initialize dragging ontouchstart', function () {
			var drag = TestUtils.renderIntoDocument(<Draggable><div/></Draggable>);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual('touch');
		});

		it('should only initialize dragging ontouchstart of handle', function () {
			var drag = TestUtils.renderIntoDocument(
				<Draggable handle=".handle">
					<div>
						<div className="handle">Handle</div>
						<div className="content">Lorem ipsum...</div>
					</div>
				</Draggable>
			);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag).querySelector('.content'));
			expect(drag.state.dragging).toEqual(false);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag).querySelector('.handle'));
			expect(drag.state.dragging).toEqual('touch');
		});

		it('should not initialize dragging ontouchstart of cancel', function () {
			var drag = TestUtils.renderIntoDocument(
				<Draggable cancel=".cancel">
					<div>
						<div className="cancel">Cancel</div>
						<div className="content">Lorem ipsum...</div>
					</div>
				</Draggable>
			);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag).querySelector('.cancel'));
			expect(drag.state.dragging).toEqual(false);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag).querySelector('.content'));
			expect(drag.state.dragging).toEqual('touch');
		});

		it('should discontinue dragging ontouchend', function () {
			var drag = TestUtils.renderIntoDocument(<Draggable><div/></Draggable>);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual('touch');

			TestUtils.Simulate.touchEnd(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual(false);
		});
	});

	describe('validation', function () {
		it('should result with invariant when there isn\'t any children', function () {
			var drag = (<Draggable/>);

			var error = false;
			try {
				TestUtils.renderIntoDocument(drag);
			} catch (e) {
				error = true;
			}

			expect(error).toEqual(true);
		});

		it('should result with invariant if there\'s more than a single child', function () {
			var drag = (<Draggable><div/><div/></Draggable>);

			var error = false;
			try {
				TestUtils.renderIntoDocument(drag);
			} catch (e) {
				error = true;
			}

			expect(error).toEqual(true);
		});
	});

	describe('mouse events', function () {
		it('should pass through onMouseDown', function () {
			var called = false;

			var drag = TestUtils.renderIntoDocument(<Draggable onMouseDown={function() {called = true;}}><div/></Draggable>);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});

		it('should not drag if onMouseDown calls preventDefault', function () {
			var drag = TestUtils.renderIntoDocument(<Draggable onMouseDown={function(e) {e.preventDefault();}}><div/></Draggable>);

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual(false);
		});

		it('should pass through onMouseUp', function () {
			var called = false;

			var drag = TestUtils.renderIntoDocument(<Draggable onMouseUp={function() {called = true;}}><div/></Draggable>);

			TestUtils.Simulate.mouseUp(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});
	});

	describe('touch events', function() {
		it('should pass through onTouchStart', function () {
			var called = false;

			var drag = TestUtils.renderIntoDocument(<Draggable onTouchStart={function() {called = true;}}><div/></Draggable>);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});

		it('should not drag if onTouchStart calls preventDefault', function () {
			var drag = TestUtils.renderIntoDocument(<Draggable onTouchStart={function(e) {e.preventDefault();}}><div/></Draggable>);

			TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(drag));
			expect(drag.state.dragging).toEqual(false);
		});


		it('should pass through onTouchEnd', function () {
			var called = false;

			var drag = TestUtils.renderIntoDocument(<Draggable onTouchEnd={function() {called = true;}}><div/></Draggable>);

			TestUtils.Simulate.touchEnd(ReactDOM.findDOMNode(drag));
			expect(called).toEqual(true);
		});
	});

});
