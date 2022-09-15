/**
 * The following class tracks changes in position for any DOM element,
 * and passes those changes to a callback.
 * 
 * How to use:
 * 1 - Instantiate the class, passing a CSS selector or a reference to a DOM element as target:
 * 
 * const myTracker = new MotionTracker('div.my-trackable-object');
 * 
 * - or -
 * 
 * const myTracker = new MotionTracker(document.querySelector('div.my-trackable-object'));
 * 
 * 2 - Whenever you want the tracker to start watching the element, pass a callback function to the "engage" method
 * 
 * myTracker.engage(myCallbackFunction);
 * 
 * 3 - Every time the object changes position, you'll receive an object listing all changes in x, y and transform
 * 
 * 4 - Once you don't need to track the element's movements anymore, you can stop the process anytime.
 *     You can reuse it later, just by repeating step 2. You can pass a different callback if you want to.
 * 
 * myTracker.disengage();
 * 
 **/

import { typeCast, explodeTransformMatrix } from '../../helpers/typecast-helper.js';
import DOMElementIdentifier from '../dom-element-identifier.js';
import ViewPortHelper from './viewport-helper.js';
import { JIJI_WORLD_DEFAULT_FRAMERATE } from '../performance-setup.js';

export class MotionTracker {
    active = false;
    targetElement;
    elementInMotionDOM;
    mObserver;
    callback;
    isMutation;
    computedMov;

    constructor (target, isTransform, eventReportName) {
        this.targetElement = typeof target === 'string'
            ? document.querySelector(target)
            : target;
        this.isTransform = isTransform;
        this.eventReportName = eventReportName;

        this._movementReportedCallbackBound = this._movementReportedCallback.bind(this);
        this.makeTrackable();
    }

    makeTrackable () {
        this.isMutation = !this.eventReportName;
        if (this.isMutation) {
            this._makeTrackableByMutationObserver();
        } else {
            this._makeTrackableByEventListener();
        }
    }

    engage (callback) {
        this.callback = callback;
        this.active = true;

        if(this.isMutation) {
            let attributeList = this.isTransform
                ? ['transform']
                : ['x', 'y'];
            const config = { attributeFilter: attributeList, attributeOldValue: true, childList: false, subtree: false };
            this.mObserver.observe(this.elementInMotionDOM, config);
        }
    }

    disengage () {
        if(this.isMutation)
            this.mObserver.disconnect();
        
        if(this.eventReportName)
            document.removeEventListener(this.eventReportName, this._movementReportedCallbackBound);

        this.active = false;
        this.motion = null;
        this.eventReportName = null;
    }

    _makeTrackableByEventListener () {
        this._resetComputedMov();
        this.computedMov.init = {x: this.targetElement.x, y: this.targetElement.y}; 
        
        document.addEventListener(this.eventReportName, this._movementReportedCallbackBound);
    }

    _movementReportedCallback () {
        let delta = {
            x: this.targetElement.x - this.computedMov.init.x,
            y: this.targetElement.y - this.computedMov.init.y
        };
        if (!ViewPortHelper.areThoseCoordsTheSame(delta, this.computedMov.current)) {
            this.computedMov.current = delta;
            this.callback(this.computedMov.current);
        }
    }

    _makeTrackableByMutationObserver() {
        let trackableValue = this.targetElement.getAttribute('trackable-selector');
        this.elementInMotionDOM = !trackableValue || trackableValue === ''
            ? this.targetElement
            : this.targetElement.querySelector(trackableValue);

        this.mObserver = this.isTransform
            ? new MutationObserver(this.reportTransform.bind(this))
            : new MutationObserver(this.reportMovement.bind(this));
    }

    reportTransform (mutationsList) {
        // matrix( scaleX(), skewY(), skewX(), scaleY(), translateX(), translateY() )
        const transformList = {};
        for (const mutation of mutationsList) {
            let newValue = explodeTransformMatrix(mutation.target.getAttribute(mutation.attributeName))
            transformList.x = newValue[4];
            transformList.y = newValue[5];
        }
        this.callback(transformList);
    }

    reportMovement (mutationsList) {
        const movementDetails = {
            x: 0,
            y: 0
        };
        let oldValue = Object.assign(movementDetails);
        for (const mutation of mutationsList) {
            let newValue = typeCast(mutation.target.getAttribute(mutation.attributeName))
            movementDetails[mutation.attributeName] = newValue - oldValue;

            oldValue = newValue;
        }
    }

    _resetComputedMov () {
        this.computedMov = {
            init: { x: 0, y: 0 },
            current: { x: 0, y: 0 }
        }
    }
}

export class changeReporter {
    constructor (eventName, objectChanged) {
        this.name = eventName;
        this.event = new CustomEvent(eventName, {
            detail: { change: objectChanged},
            bubbles: false,
            cancelable: true,
            composed: false,
        });
    }
    
    report () {
        document.dispatchEvent(this.event);
    }
}
