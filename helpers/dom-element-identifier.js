export default class DOMElementIdentifier {
    static isHTMLElement (element) {
        return element instanceof HTMLElement;
    }

    static isSVGElement (element) {
        return element instanceof SVGElement;
    }

    static isSVGContainerElement (element) {
        return element instanceof SVGSVGElement;
    }

    static whatIsThis (element) {
        let topClass;

        if (this.isHTMLElement(element))
            topClass = 'HTMLElement';

        if (this.isSVGElement(element)) {
            topClass = 'SVGElement';
        }

        return {
            topClass: topClass,
            constructorName: element.constructor.name
        }
    }

    static findParentSVGContainer (element) {
        let getAllParents = node => (node.parentElement ? getAllParents(node.parentElement) : []).concat([node]);

        let SVGParents = getAllParents(element).filter(item => item.tagName.toLowerCase() === 'svg');
        let closest = SVGParents.slice(-2, 1)[0];
        return closest || null;
    }

    static isTopSVGContainer (element) {
        return this.isSVGContainerElement(element) && !this.findParentSVGContainer(element)
            ? true
            : false;
    }
}
