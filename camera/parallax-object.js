import ViewPortHelper from './viewport-helper.js';

export class ParallaxObject {
    constructor(DOMelement, parallaxTracker, depth) {
        this.parallaxTracker = parallaxTracker;
        this.depth = Number(depth); // depth means "distance from Camera"
        this.target = DOMelement;
        this.targetCoords = ViewPortHelper.measureSVGElement(this.target);
        this.translate = {
            x: 0,
            y: 0
        }
        this.lastFrameOffset = {
            x: 0,
            y: 0
        }
        this.updatePosition();
    }

    updatePosition () {
        // calculate distance from Vanishing Poing
        let coordsFromVPoint = {
            x: this.targetCoords.center.x - this.parallaxTracker.centerX,
            y: this.targetCoords.center.y - this.parallaxTracker.centerY,
        }
        let coordsZAdjusted = {
            x: coordsFromVPoint.x / this.depth,
            y: coordsFromVPoint.y / this.depth
        }
        let offset = {
            x: coordsZAdjusted.x - coordsFromVPoint.x,
            y: coordsZAdjusted.y - coordsFromVPoint.y
        }

        if(offset.x !== this.lastFrameOffset.x || offset.y !== this.lastFrameOffset.y) {
            this.lastFrameOffset = offset;

            this.target.setAttribute('transform', `translate(${offset.x} ${offset.y})`);
        }
    }
}


export function ParallaxProgrammer (cameraFrame, parallaxTracker) {
    let objectsToBeParallaxed = Array.from(cameraFrame.querySelectorAll('.parallax-object'));
    let findObjectsInShadowDOM = () => {
        let shadows = Array.from(cameraFrame.querySelectorAll('foreignObject'));
        let objectsInsideShadowDOM = shadows.reduce((ax, shadow) => {
            let result = shadow.firstElementChild.shadowRoot.querySelector('.parallax-object');
            if(result)
                ax.push(result);
            return ax;
        }, []);
        return objectsInsideShadowDOM;
    }

    let objectsArr = objectsToBeParallaxed.concat(findObjectsInShadowDOM());

    return objectsArr.map(item => {
        return new ParallaxObject(item, parallaxTracker, Number(item.dataset.depth));
    });
}
