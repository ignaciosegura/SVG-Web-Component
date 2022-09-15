// Bridge zoom control class
import ViewPortHelper from './helpers/viewport-helper.js';
import { ParallaxObject, ParallaxProgrammer } from './helpers/parallax-object.js';
import { MotionTracker } from './helpers/camera-controller-motion-tracker.js';
import { JIJI_XY_CHANGE_EVENT_NAME } from '../../views/learn/animators/jiji-animator.js';
import { gsap } from '../lib/third-party/gsap/all.js';
import { CustomEventsManager } from '../customEventsManager.js';

export const ZOOM_STATUS = {
	out: 'out',
	moving: 'moving',
	in: 'in',
	tracking: 'tracking'
}

export const CAMERA_EVENTS = {
	finishedMoving: 'camera:finishedMoving'
}

export const ZOOM_LEVEL = {
	bridgeGame: 320,
	scene: 320,
	camTracking: 320
};

export const CAMERA_DEFAULTS = {
	transitionDuration: 2000,
	outermostPoint: 640,
	initialZoomFactor: 1,
	frameSize: {
		width: 640,
		height: 480
	}
}

export const CAMERA_SPEED = {
	instant: 0,
	superFast: 100,
	faster: 500,
	fast: 1000,
	slow: 2000,
	slower: 3000,
	firstZoom: 1000,
	returningZoom: 0,
	firstZoomDelay: 1200
}

export const CAMERA_FOCUS_TYPES = {
	scene: 'scene',
	element: 'element',
	custom: 'custom'
}

export const VIEWPORT_FACTORS = {
	default: { x: 0.5, y: 0.5 },
	bridgeGame: { x: 0.4, y: 0.65 }
}

export class CameraController {
	constructor (viewportSelector, cameraFrameSelector, extraSettings = {}) {
		this.viewportSelector = viewportSelector;
		this.cameraFrameSelector = cameraFrameSelector;
		this.transitionDefaultDuration = extraSettings.transitionDuration || CAMERA_DEFAULTS.transitionDuration;
		this.zoomStatus = ZOOM_STATUS.out;
		this.oldZoomStatus = null;
		this.ready = false;
		this.viewBox = {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		}
		this.context;
		this.viewport = {};
		this.focalRadius = 0;
		this.cameraFrame = {};
		this.objectTracker; // This tracker follows other objects' movement and reports back to the camera
		this.parallaxTracker = {}; // this tracker follows camera movement for Parallax
		this.parallaxObjects = [];
		this.parallaxObjectsWaitingList = [];
		this.focusedOn = {
			type: null,
			element: null,
			scene: null,
		}
	}

	reset () {
		this.constructor();
	}

	init (scene, context) {
		if (this.ready)
			return;
		
		this.context = context || document;

		this.viewport.dom = this.context.querySelector(this.viewportSelector);
		this.cameraFrame = {
			dom: this.context.querySelector(this.cameraFrameSelector),
			size: CAMERA_DEFAULTS.frameSize,
			focalRadius: 320
		}
		this.targetSceneCoords = null;

		this.getAndSaveInitialCoords();
		this._setParallaxTracker();

		let targetSceneProm = this.getSceneWhenReady(scene);
		targetSceneProm.then(_ => {
			return this.focusCameraOnScene(scene);
		}).then( _ => {
			this.parallaxObjects = ParallaxProgrammer(this.cameraFrame.dom, this.parallaxTracker);
			this.processParallaxObjectsWaitingList();
			this._setReady();
		});

		return targetSceneProm;
	}

	getSceneWhenReady (sceneSelector) {
		let scene = this.context.getElementById(sceneSelector);
		let interval;

		if (scene)
			return Promise.resolve();

		return new Promise((resolve, reject) => {
			interval = setInterval(() => {
				scene = this.context.getElementById(sceneSelector);

				if (scene) {
					resolve();
					clearInterval(interval);
				}
			}, 10);
		});
	}

	registerParallaxObject(item, depth) {
		if(this.ready) {
			this.parallaxObjects.push(new ParallaxObject(item, this.parallaxTracker, depth));
		} else {
			this.parallaxObjectsWaitingList.push({item, depth});
		}
	}

	processParallaxObjectsWaitingList() {
		this.parallaxObjectsWaitingList.forEach(target => {
			this.parallaxObjects.push(new ParallaxObject(target.item, this.parallaxTracker, target.depth));
		})
	}

	getAndSaveInitialCoords () {
		this.viewport.coords = this.measureElement(this.viewport.dom);
		this.cameraFrame.coords = this.measureElement(this.cameraFrame.dom);
		this.cameraFrame.ratio = this.cameraFrame.coords.size.width / this.cameraFrame.coords.size.height;
	}

	focusCameraOnScene(sceneId, delayInMsecs = 0, speed = 0) {
		speed = typeof speed !== 'undefined'
			? speed
			: CAMERA_SPEED.slower;
		let sceneDOM = this.context.getElementById(sceneId);
		return this.moveCameraToScene(sceneDOM, speed, 'power3.out', delayInMsecs).then(_ => {
			this.focusedOn.type = CAMERA_FOCUS_TYPES.scene;
			this.focusedOn.scene = sceneId;
		});
	}

	focusCameraOnBridgeGame (gameIndex, speed = CAMERA_SPEED.slow) {
		let selector = '#bridge-game-camera-target-' + gameIndex;
        return this.selectAndFocusCameraOnSomething(selector, VIEWPORT_FACTORS.bridgeGame, speed, ZOOM_LEVEL.bridgeGame);
	}

	selectAndFocusCameraOnSomething (selector, viewportFactor, cameraSpeed, focalRadius, delayInSecs) {
		let target = document.querySelector(selector);
		return this.focusCameraOnSomething(target, viewportFactor, cameraSpeed, focalRadius, delayInSecs);
	}

	focusCameraOnSomething (itemDOM, viewportFactor, cameraSpeed = 0, focalRadius, delayInSecs = 0) {
		if(this.focusedOn.type === CAMERA_FOCUS_TYPES.element && itemDOM.isSameNode(this.focusedOn.element))
			return Promise.resolve(); // Already focused

		let itemCoords = ViewPortHelper.measureElement(itemDOM);
		focalRadius = focalRadius || this.cameraFrame.focalRadius;
		viewportFactor = viewportFactor || VIEWPORT_FACTORS.default;
		let delayInMsecs = delayInSecs * 1000;
        
        return this.moveCameraToSpot(itemCoords.absoluteCenter, viewportFactor, cameraSpeed, focalRadius, 'power3.out', delayInMsecs).then( () => {
			this.focusedOn.type = CAMERA_FOCUS_TYPES.element;
			this.focusedOn.element = itemDOM;
		});
	}

	moveCameraToScene (sceneDOM, transitionDuration, ease, delayInMsecs) {
		let targetSceneCoords = ViewPortHelper.measureElement(sceneDOM);
		this.viewBox = {
			...targetSceneCoords.origin,
			...targetSceneCoords.size
		}
		this.focalRadius = targetSceneCoords.size.width / 2;
		return this.executeCameraMovement(transitionDuration, ease, delayInMsecs);
	}

	moveCameraToSpot (targetCoords, viewportFactor, transitionDuration, focalRadius, ease, delayInMsecs = 0) {
		this.saveZoomStatus(ZOOM_STATUS.moving);
		let frameSize = {
			width: focalRadius * 2,
			height: focalRadius * 2 / this.cameraFrame.ratio
		}
		let cameraOffset = ViewPortHelper.mapViewportFactorToCameraFrame(viewportFactor, frameSize, true);
		this.viewBox = {
			x: targetCoords.x - cameraOffset.x - focalRadius,
			y: targetCoords.y - cameraOffset.y - (focalRadius / this.cameraFrame.ratio),
			...frameSize
		}
		this.focalRadius = focalRadius;
		return this.executeCameraMovement(transitionDuration, ease, delayInMsecs);
	}

	executeCameraMovement (duration, ease = 'power3.easeOut', delayInMsecs = 0) {
		this.saveZoomStatus(ZOOM_STATUS.moving);
		let cameraPromise = new Promise((resolve, reject) => {
			let tl = gsap.timeline();
			let valueString = this.viewBoxToString(this.viewBox);

			this._setCameraTimeline(tl, duration, ease, delayInMsecs);
			tl.call(() => {
				this.saveZoomStatus(ZOOM_STATUS.in);
				CustomEventsManager.dispatch(CAMERA_EVENTS.finishedMoving);
				resolve();
			});
			tl.eventCallback('onUpdate', this._updateParallaxTrackerListener.bind(this));
		});
		return cameraPromise;
	}

	engageMotionTrackObject (target, focalRadius = 100, timeInMSecs = 0, viewportFactor, isTransform = false) {
		let initViewBox = {...this.viewBox};
		let focal = {
			target: focalRadius * 2,
			width: initViewBox.width,
			height: initViewBox.height,
			x: 0,
			y: 0
		}

		const callback = (motion) => {
			this.viewBox.x = initViewBox.x + motion.x + focal.x;
			this.viewBox.y = initViewBox.y + motion.y + focal.y;
			this.viewBox.width = focal.width;
			this.viewBox.height = focal.height;
			this.instaSetCameraToViewbox();
		}
		viewportFactor = viewportFactor || VIEWPORT_FACTORS.default;
		this.objectTracker = new MotionTracker(target, isTransform, JIJI_XY_CHANGE_EVENT_NAME);

		let gsapParams = {
			x: (focal.width - focal.target) / 2,
			width: focal.target,
			height: focal.target / this.cameraFrame.ratio,
			duration: timeInMSecs / 1000,
			ease: 'power2.inOut'
		}
		gsapParams.y = gsapParams.x / this.cameraFrame.ratio;

		gsap.to(focal, gsapParams);
		this.objectTracker.engage(callback);
		this.oldZoomStatus = this.zoomStatus;
		this.zoomStatus = ZOOM_STATUS.tracking;
	}

	disengageMotionTrackObject () {
		if (!this.objectTracker)
			return;

		this.objectTracker.disengage();
		this.zoomStatus = this.oldZoomStatus;
		this.objectTracker = null;
	}

	instaSetCameraToViewbox () {
		this.cameraFrame.dom.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
	}

	saveZoomStatus (status) {
		this.zoomStatus = ZOOM_STATUS[status];
	}

	/* 
	 * HELPER METHODS
	 */

	_setParallaxTracker () {
		Object.defineProperties(this.parallaxTracker, {
			centerX: {
				enumerable: true,
				get: () => {
					return Number(this.parallaxTracker.x) + (Number(this.parallaxTracker.width) / 2);
				}
			},
			centerY: {
				enumerable: true,
				get: () => {
					return Number(this.parallaxTracker.y) + (Number(this.parallaxTracker.height) / 2);
				}
			}
		});
	}

	_setCameraTimeline (tl, timeInMsecs, ease, delayInMsecs) {
		let valueString = this.viewBoxToString(this.viewBox);

		if (timeInMsecs === 0 && delayInMsecs === 0) {
			tl.set(this.cameraFrame.dom, { attr: { viewBox: valueString }, ease: ease });
			tl.set(this.parallaxTracker, { x: this.viewBox.x, y: this.viewBox.y, width: this.viewBox.width, height: this.viewBox.height, ease: ease});
		} else {
			let delayInSecs = delayInMsecs / 1000;
			let timeInSecs = timeInMsecs / 1000;
			tl.delay(delayInSecs);
			tl.to(this.cameraFrame.dom, timeInSecs, { attr: { viewBox: valueString }, ease: ease }, delayInSecs);
			tl.to(this.parallaxTracker, timeInSecs, { x: this.viewBox.x, y: this.viewBox.y, width: this.viewBox.width, height: this.viewBox.height, ease: ease}, delayInSecs);
		}
	}

	_updateParallaxTrackerListener () {
		this.parallaxObjects.forEach(item => item.updatePosition());
	}

	_setReady () {
		this.ready = true;
		this.cameraFrame.dom.classList.add('ready');
	}

	/* 
	 * MATH METHODS
	 */

	viewBoxToString (s) {
		return s.x + ' ' + s.y + ' ' + s.width + ' ' + s.height;
	}

	factorDifferenceBetweenCameraAndViewport () {
		let viewportSize = this.viewport.coords.size;
		let camFrameSize = this.cameraFrame.coords.size;

		return {
			x: viewportSize.width / camFrameSize.width,
			y: viewportSize.height / camFrameSize.height
		}
	}

	multiplyCoordsByFactor (coords, factor) {
		return ViewPortHelper.multiplyCoordsByFactor(coords, factor)
	}

	divideCoordsByFactor (coords, factor) {
		return this.multiplyCoordsByFactor(coords, 1 / factor);
	}

	addCoordinates (origin, end) {
		return ViewPortHelper.addCoordinates(origin, end);
	}

	substractCoordinates (origin, end, preventNegative) {
		return ViewPortHelper.substractCoordinates(origin, end, preventNegative);
	}

	sizeToXY (size) {
		return {
			x: size.width,
			y: size.height
		}
	}

	selectAndMeasureElement (selector) {
		return ViewPortHelper.selectAndMeasureElement(selector);
	}

	measureElement (element) {
		return ViewPortHelper.measureElement(element);
	}

	calculateScaleFactor (element) {
		return ViewPortHelper.calculateScaleFactorForSVGElement(element);
	}

	findCenterOfCoords (coords) {
		return ViewPortHelper.findCenterOfCoords(coords);
	}

	mapViewportPositionToViewBox (position) {
		return {
			x: this.viewBox.x + (this.viewBox.width * position.x),
			y: this.viewBox.y + (this.viewBox.height * position.y)
		}
	}

	calculateCoordsFromPositionInViewport (position) {
		return ViewPortHelper.calculateCoordsFromPositionInAContainer(position, this.viewport.coords);
	}

	// To be called from Navigator when window is resized
	windowWasResized () {
		if (!this.ready)
			return;
		
		this.getAndSaveInitialCoords();
	}

	static cameraIsSet (cameraInstance) {
		return cameraInstance && cameraInstance instanceof CameraController;
	}
}
