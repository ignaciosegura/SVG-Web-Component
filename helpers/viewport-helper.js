// A set of functions helping collect information regarding screen layout.

import DOMElementIdentifier from '../dom-element-identifier.js';

class ViewPortHelper {
    static selectAndMeasureElement (selector, context = document) {
        let target = context.querySelector(selector);
        return this.measureElement(target);
    }

    static measureElement (element) {
        return DOMElementIdentifier.isHTMLElement(element)
            ? this.measureDOMElement(element)
            : this.measureSVGElement(element);
    }

    static measureDOMElement (element) {
        let coords = {
            origin: {
                x: element.offsetLeft,
                y: element.offsetTop
            },
            size: {
                width: element.clientWidth,
                height: element.clientHeight
            },
            boundingRect: element.getBoundingClientRect()
        }
        coords.innerSize = this.getInnerDimensionsOfDOMElement(element);
        coords.outerSize = this.getOuterDimensionsOfDOMElement(element);
        coords.center = this.findCenterOfCoords(coords);
        return coords;
    }

    static getInnerDimensionsOfDOMElement (element) {
        let computedStyle = getComputedStyle(element)

        let height = element.clientHeight // height with padding
        let width = element.clientWidth // width with padding

        height -= parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom)
        width -= parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight)
        return { width, height }
    }

    static getOuterDimensionsOfDOMElement (element) {
        let computedStyle = getComputedStyle(element)

        let height = element.clientHeight // height with padding
        let width = element.clientWidth // width with padding

        height += parseFloat(computedStyle.marginTop) + parseFloat(computedStyle.marginBottom)
        width += parseFloat(computedStyle.marginLeft) + parseFloat(computedStyle.marginRight)
        return { width, height }
    }

    static measureSVGElement (element) {
        let box = this.getSVGElementBoundingBox(element);
        let coords = {
            origin: {
                x: box.x,
                y: box.y
            },
            size: {
                width: box.width,
                height: box.height
            },
            boundingRect: element.getBoundingClientRect()
        }
        coords.absoluteOrigin = this.getAbsoluteXY(element, coords.origin);
        coords.center = this.findCenterOfCoords(coords);
        coords.absoluteCenter = this.findAbsoluteCenterOfCoords(coords);

        return coords;
    }
    static getAbsoluteXY (element, coords) {
        let parent = element.parentElement.closest('svg:not(#camera-frame)');

        if (!parent)
            return coords;

        let parentMeasures = this.measureSVGElement(parent);
        return {
            x: coords.x + parentMeasures.absoluteOrigin.x,
            y: coords.y + parentMeasures.absoluteOrigin.y,
        }
    }

    static getSVGElementBoundingBox (element) {
        let tagsWithoutExplicitDimensions = ['g', 'text', 'circle'];
        if (tagsWithoutExplicitDimensions.indexOf(element.tagName) !== -1)
            return element.getBBox();

        return {
            x: element.x.baseVal.value,
            y: element.y.baseVal.value,
            width: element.width.baseVal.value,
            height: element.height.baseVal.value
        }
    }

    static calculateScaleFactorForSVGElement (element) {
        let internalScale = element.viewBox.baseVal.width;
        let externalScale = element.getBoundingClientRect().width;

        return internalScale / externalScale;
    }

    static calculateCoordsFromPositionInAContainer (position, containerCoords) {
        const hasRequiredObjects = !!(position && containerCoords && containerCoords.size);
        if (!hasRequiredObjects) {
            if (!position) {
                console.warn('viewport-helper.js: fn calculateCoordsFromPositionInAContainer: position object is undefined or null');
            }
            if (!containerCoords) {
                console.warn('viewport-helper.js: fn calculateCoordsFromPositionInAContainer: containerCoords object is undefined or null');
            } else if (!containerCoords.size) {
                console.warn('viewport-helper.js: fn calculateCoordsFromPositionInAContainer: containerCoords.size object is undefined or null');
            }
            return { x: null, y: null };
        }

        return {
            x: Math.round(position.x * containerCoords.size.width),
            y: Math.round(position.y * containerCoords.size.height)
        }
    }

    static findParentContainer (element, selector) {
        return element.closest(selector);
    }

    static findCenterOfCoords (coords) {
        return {
            x: coords.origin.x + (coords.size.width / 2),
            y: coords.origin.y + (coords.size.height / 2)
        }
    }

    static findAbsoluteCenterOfCoords (coords) {
        return {
            x: coords.absoluteOrigin.x + (coords.size.width / 2),
            y: coords.absoluteOrigin.y + (coords.size.height / 2)
        }
    }

    static addCoordinates (origin, end) {
        return {
            x: origin.x + end.x,
            y: origin.y + end.y
        }
    }

    static sizeAsXY (size) {
        return {
            x: size.width,
            y: size.height
        }
    }

    static areThoseCoordsTheSame(coords1, coords2) {
        return coords1.x === coords2.x && coords1.y === coords2.y;
    }

    static mapViewportFactorToCameraFrame (viewportFactor, frameSize, offsetFromCenter) {
        let compViewportFactor = {...viewportFactor};
        if (offsetFromCenter) {
            compViewportFactor.x = viewportFactor.x - 0.5;
            compViewportFactor.y = viewportFactor.y - 0.5;
        }

        return {
            x: compViewportFactor.x * frameSize.width,
            y: compViewportFactor.y * frameSize.height
        }
    }

    static mapViewportFactorToCameraFrameAndPosition (viewportFactor, frameSize, framePosition, offsetFromCenter) {
        let mapToFrame = this.mapViewportFactorToCameraFrame(viewportFactor, frameSize, framePosition, offsetFromCenter);
        return {
            x: framePosition.x + mapToFrame.x,
            y: framePosition.y + mapToFrame.y,
        }
    }

    static mapStaticCoordsToViewportFactor (coords) {
        return {
            x: coords.x / window.innerWidth,
            y: coords.y / window.innerHeight
        }
    }

    static substractCoordinates (origin, end, preventNegative = false) {
        let output = {
            x: origin.x - end.x,
            y: origin.y - end.y
        }
        return preventNegative
            ? this.preventNegativeFinalCoords(output)
            : output;
    }

    static 	multiplyCoordsByFactor (coords, factor) {
		return {
			x: (coords && coords.x) ? Math.round(coords.x * factor) : null,
			y: (coords && coords.y) ? Math.round(coords.y * factor) : null
		}
	}

    static preventNegativeFinalCoords (coords) {
        for (let axis in coords) {
            coords[axis] = coords[axis] > 0
                ? coords[axis]
                : 0;
        }
        return coords;
    }
}

export default ViewPortHelper;
