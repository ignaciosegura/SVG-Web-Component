import { domDiffer } from '../domDiffer.js';
import { WebComponent } from './web-component.js';
import { typeCast } from '../helpers/typecast-helper.js';
import { makeIntoArrayIfNeeded, areThoseArraysTheSame, checkDifferencesBetweenTwoArrays } from '../helpers/array_helper.js';
import { SVGComponentSpawn } from './helpers/svg-component-spawn.js';
import { JIJI_WORLD_EVENTS } from './helpers/jijiworld-events.js';

export class SVGWebComponent extends WebComponent {
    constructor(...args) { // Path should not have trailing slash
        let path = args[0], templateName = args[1], cssName = args[2];
        if (args.length === 1) {
            const pathSplit = path.split('/');
            templateName = pathSplit.splice(pathSplit.length - 1, 1)[0].replace('.js', '');
            path = pathSplit.join('/');
            cssName = templateName + '.css';
            templateName = templateName + '.html';
        } else {
            [path, templateName, cssName] = args;
        }
        super(path, templateName, cssName, true);

        this.addCSSToComponent(path, cssName);
        this.elementDOM;
        this.parentContainer;
        this.priv.isInShadow;
    }

    addCSSToComponent(path, cssName) {
        if (!path || !cssName)
            return false;

        let nameString = `svg-component-${this.tagName.toLowerCase()}`;
        let alreadyThereCSS = document.head.querySelector(`link[name=${nameString}]`);

        if (alreadyThereCSS) {
            this.priv.cssLink = alreadyThereCSS;
            return;
        }

        const linkElem = document.createElement('link');
        linkElem.setAttribute('rel', 'stylesheet');
        linkElem.setAttribute('href', `${path}/${cssName}`);
        linkElem.setAttribute('name', nameString);
        document.head.appendChild(linkElem);
        this.priv.cssLink = linkElem;
    }

    async loadTemplateAndFirstRender(path, templateName) {
        this.onBeforeTemplateLoaded();
        let response = await this.fetchTemplate(path, templateName);
        this.onTemplateLoaded();
        this.priv.rawTemplate = response;
        await this.bootupInactiveSVGWebComponents();
        this.priv.rawTemplateDOM = this._stringToHTML(this.interpolate(this.priv.rawTemplate));
        domDiffer.render(this.priv.rawTemplateDOM, this.parentContainer);
        this._setRefs(this.parentContainer);
        this.elementDOM = this.parentContainer.firstChild;
        this.renderStaticRepeaters();
        await this.bootupInactiveSVGWebComponents();
        this._postLoadActions();
        this.onTemplateRendered();
        this._emitReadyEvent();
    }

    async fetchTemplate (path, templateName) {
        let template = SVGComponentSpawn.registry[this.constructor.name].template;
        if (template !== null)
            return template;

        template = await super.loader(path, templateName);
        SVGComponentSpawn.registry[this.constructor.name].template = this._templateCleanup(template);
        return template;
    }

    _postLoadActions () {
        this.priv.isInShadow = !Object.is(this.parentContainer.getRootNode(), document);
        this._appendCSSIfInShadow();
        this.getContainerAttributes();
        this.observeContainerChanges(this.parentContainer);
        this.priv.ready = true;
    }

    _appendCSSIfInShadow () {
        if (!this.priv.isInShadow || !this.priv.cssLink)
            return;
        
        let root = this.parentContainer.getRootNode();
        let alreadyExists = root.querySelector('link[name=' + this.priv.cssLink.getAttribute('name') + ']');
        if (alreadyExists) return;

        let clonedCSS = this.priv.cssLink.cloneNode();
        root.insertBefore(clonedCSS, root.firstChild);
    }

    _stringToHTML(str) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(str, 'text/html');
        return doc.body;
    }

    renderThenInject () {
        if (!this.priv.ready)
            return false;

        let rendered = this.interpolate(this.priv.rawTemplate);
        this.priv.rawTemplateDOM = this._stringToHTML(rendered);
        domDiffer.render(this.priv.rawTemplateDOM, this.parentContainer);
        this.renderStaticRepeaters();
        this.reRenderRepeaters();
        this.onComponentRenderedAgain();
    }

    bootupInactiveSVGWebComponents () {
        if (!this.parentContainer) this.parentContainer = this;
        return SVGComponentSpawn.bootupInactiveChildSVGComponents(this.parentContainer, this);
    }

    renderStaticRepeaters() {
        let staticRepeaters = Array.from(this.parentContainer.querySelectorAll(':not([component])[repeat]'));
        staticRepeaters = staticRepeaters.filter(item => item.closest('[component]').getAttribute('component') === this.component);

        staticRepeaters.forEach( item => {
            let attributeValue = typeCast(item.getAttribute('repeat'));
            let arrayData = isNaN(attributeValue)
                ? makeIntoArrayIfNeeded(this._getPointer(attributeValue, this))
                : makeIntoArrayIfNeeded(arrayData);
            let targetAttribute = SVGComponentSpawn.findRepeaterTargetAttribute(item);

            arrayData.forEach(value => {
                let itemClone = item.cloneNode();
                if(itemClone.attributes[targetAttribute])
                    itemClone.setAttribute(targetAttribute, value);
                item.parentElement.appendChild(itemClone);
            })
            item.remove();
        });
    }

    reRenderRepeaters() {
        let components = SVGComponentSpawn.locateAllChildRepeaters(this.parentContainer);
        Array.from(components).forEach(item => {
            let tagName = item.attributes.component.value;
            let targetAtribute = SVGComponentSpawn.findRepeaterTargetAttribute(item);
            let oldNodes = SVGComponentSpawn.locateAllRepeatedSVGComponentsInsideDOMNode(item);
            let oldRepeaterSource = this._extractRepeaterOldValues(oldNodes, targetAtribute);
            let repeaterSource = makeIntoArrayIfNeeded(this._getProp(item.getAttribute('repeat'), this));
            let diffMap = checkDifferencesBetweenTwoArrays(oldRepeaterSource, repeaterSource);
            let attributeNames = item.getAttributeNames();

            diffMap.forEach((step, index) => {   
                switch (step) {
                    case 'add':
                        let instance = SVGComponentSpawn._spawnOneRepeatInstance(item, attributeNames, targetAtribute, repeaterSource[index], index);
                        item.appendChild(instance);

                        if (instance.attributes.index) {
                            let indexedInterpolation = this.interpolate(instance.outerHTML, { ...this, index: index });
                            let parser = new DOMParser();
                            let parsed = parser.parseFromString(indexedInterpolation, 'text/html');
                            let outputStats = domDiffer.diffAttributes(instance, parsed.body.firstChild);
                        }
                        SVGComponentSpawn._spawnChildProm(tagName, instance);
                        break;
                    case 'update':
                        oldNodes[index].setAttribute(targetAtribute, repeaterSource[index]);
                        break;
                    case 'remove':
                        oldNodes[index].remove();
                }
            });
        });
    }

    _extractRepeaterOldValues (oldNodes, repeaterTargetProperty) {
        return oldNodes.map(oldNode => {
            return typeCast(oldNode.parentContainer.getAttribute(repeaterTargetProperty));
        });
    }

    getContainerAttributes() {
        let attributes = this.parentContainer.getAttributeNames();
        attributes.forEach(attr => {
            let camelCasedAtt = this._camelCaseAttr(attr);
            this[camelCasedAtt] = typeCast(this.parentContainer.getAttribute(attr));
        });
        return attributes;
    }

    hide() {
        this.priv.active = false;
        this.parentContainer.classList.add('hide');
    }

    show() {
        this.priv.active = true;
        this.parentContainer.classList.remove('hide');
    }

    remove () {
        super.remove();
        let children = SVGComponentSpawn.locateAllSVGComponentsInsideDOMNode(this.elementDOM);
        children.forEach(child => child.remove());
        let locator = this.priv.componentLocator;
        let idx = SVGComponentSpawn.list.findIndex(item => item.priv.componentLocator === locator);
        SVGComponentSpawn.list.splice(idx, 1);
        this.parentContainer.remove();
    }

    onRemoved () {
        super.onRemoved();
    }

    onActiveStatusChanged(newVal, oldVal) {
        super.onActiveStatusChanged(newVal, oldVal);
    }

    onTemplateRendered() {
        super.onTemplateRendered();
    }

    _emitReadyEvent () {
        const readyEvent = new CustomEvent(JIJI_WORLD_EVENTS.componentReady, {
            bubbles: true,
            detail: { origin: this.priv.componentLocator },
            cancelable: true,
            composed: false
        });
        this.parentContainer.dispatchEvent(readyEvent);
    }

    /**
     * Static methods for Component spawning
    **/
    static bootSVGWebComponent(tagName, className, context) {
        return SVGComponentSpawn.bootSVGWebComponent(tagName, className, context);
    }

    static spawnSVGWebComponent(tagName, item, context) {
        return SVGComponentSpawn.spawnSVGWebComponent(tagName, item, context);
    }

    static wipeOutAllComponentsNotInDOM () {
        SVGComponentSpawn.wipeOutAllComponentsNotInDOM();
    }
}
