import { typeCast } from '../helpers/typecast-helper.js';
import { fileLoader } from './helpers/file-loader.js';
import { makeObservable } from './helpers/make-observable.js';
import { makeIntoArrayIfNeeded } from '../helpers/array_helper.js';
import { CustomEventsManager } from '../customEventsManager.js';
import { domDiffer } from '../domDiffer.js';
import { SVGComponentSpawn } from './helpers/svg-component-spawn.js';

export class WebComponent extends HTMLElement {
    constructor(path, templateName, cssName, isSVG) { // Path should not have trailing slash
        super();

        this.priv = { // Private info. Accessible, but only needed for internal management.
            rawTemplate: '',
            processedTemplate: '',
            active: true,
            ready: false,
            isSVG: isSVG || false,
            cssLink: null,
            cssIsLoaded: false,
            componentName: null,
            componentID: null,
            componentLocator: null,
            diffOutcome: null,
            scheduledRepaint: null
        };

        if (!isSVG) {
            this.attachShadow({ mode: 'open' });
            this.template = document.createElement('template');
            this.template.innerHTML = '';
            this.addCSSToComponent(path, cssName);
        }
        this.renderThenInject = this.renderThenInject.bind(this);
        this.cssOnLoad = this.cssOnLoad.bind(this);

        this.templateLoaded = path && templateName
            ? this.loadTemplateAndFirstRender(path, templateName)
            : Promise.resolve();
        makeObservable(this.priv, 'active', false, this.onActiveStatusChanged.bind(this));
    }

    addCSSToComponent (path, cssName) {
        if (path && cssName)
            this.priv.rawTemplate = `<link rel="stylesheet" href="${path}/${cssName}"></link>`;
    }

    connectedCallback() {
        this.getAttributes();
    }

    disconnectedCallback () {
        if(this.priv.cssLink)
            this.priv.cssLink.removeEventListener('load', this.cssOnLoad);

        // if svgcomponent, shadowRoot does not exist
        let SVGComponents = SVGComponentSpawn.locateAllSVGComponentsInsideDOMNode(this.shadowRoot ? this.shadowRoot : this);
        SVGComponents.forEach( component => component.remove() );
        this.onRemoved();
    }

    attributeChangedCallback(value) {
        this.renderThenInject();
    }

    async loadTemplateAndFirstRender (path, templateName) {
        this.onBeforeTemplateLoaded();
        let response = await this.fetchTemplate(path, templateName);
        this.onTemplateLoaded();
        this.priv.rawTemplate += response;
        this.firstRender();
        this._setRefs(this.shadowRoot);
        this.elementDOM = this.shadowRoot.firstChild;
        await SVGComponentSpawn.bootupInactiveChildSVGComponents(this.shadowRoot, this);

        this.priv.ready = true;
        this.priv.active = true;
        this.priv.componentID = WebComponent.listComponent(this) - 1;
        this.setAttribute('component-id', this.priv.componentID);
        this._listenToCSSLoading();
        this.observeContainerChanges(this);
        this.onTemplateRendered();
    }

    async fetchTemplate (path, templateName) {
        let template = WebComponent.getTemplateFromRegistry(this.constructor.name);
        if (template !== null)
            return template;

        template = await WebComponent.registerComponentTemplate(this.constructor.name, this.tagName, path, templateName);
        return template;
    }

    scheduleRender () {
        window.cancelAnimationFrame(this.priv.scheduledRepaint);
        this.priv.scheduledRepaint = window.requestAnimationFrame(this.renderThenInject);
    }

    firstRender () {
        this.getAttributes();
        this.template.innerHTML = this.interpolate(this.priv.rawTemplate);
        domDiffer.render(this.template.content, this.shadowRoot);
        this.template.innerHTML = '';
        this.renderRepeaters();
        this.priv.scheduledRepaint = null;
    }

    renderThenInject () {
        this.firstRender();
        this.onComponentRenderedAgain();
    }

    interpolate (str, extraValues) {
        let contextForInterpolation = extraValues instanceof Object
            ? extraValues
            : this;  
        str = str.replace( // Interpolate
            /\${([^}]+)}/g,
            (_, prop) => {
                let retrievedValue = this._getProp(prop, contextForInterpolation);
                if (retrievedValue === undefined) {
                    try {
                        let func = contextForInterpolation.index !== undefined
                            ? Function('"use strict"; let index = ' + contextForInterpolation.index + '; return (' + prop + ')').bind(contextForInterpolation)
                            : Function('"use strict"; return (' + prop + ')').bind(contextForInterpolation);
                        retrievedValue = func();
                    } catch {
                        retrievedValue = '${' + prop + '}';
                    }
                }
                return retrievedValue;
            }
        );
        return str;
    }

    renderRepeaters () {
        let repeaters = Array.from(this.shadowRoot.querySelectorAll('[repeat]'));
        repeaters.forEach(item => {
            let repeatAttribute = item.getAttribute('repeat');
            let arrayData = isNaN(Number(repeatAttribute))
                ? makeIntoArrayIfNeeded(this[repeatAttribute])
                : makeIntoArrayIfNeeded(repeatAttribute);
            let targetAttribute = SVGComponentSpawn.findRepeaterTargetAttribute(item);
            let isWebComponent = customElements.get(item.tagName.toLowerCase()) !== undefined;
            let newNodesContainer = document.createDocumentFragment();
            let oldNodesContainer = document.createDocumentFragment();
            let parentNode;

            if (isWebComponent) {
                parentNode = item.parentElement;
                oldNodesContainer.appendChild(item);
            }

            arrayData.forEach((value, index) => {
                let interpolationContext = value instanceof Object
                    ? value
                    : { ...this };
                interpolationContext.index = index;
                let clone = isWebComponent
                    ? item.cloneNode()
                    : this.manualInterpolation(item.cloneNode(true), interpolationContext);
                
                if (targetAttribute)
                    clone.setAttribute(targetAttribute, value);

                clone.setAttribute('index', index);
                clone.removeAttribute('repeat');
                newNodesContainer.appendChild(clone);
            });

            if (isWebComponent) {
                domDiffer.render(newNodesContainer, oldNodesContainer);
                Array.from(oldNodesContainer.childNodes).forEach(newNode => {
                    parentNode.appendChild(newNode);
                });
            } else {
                let parent = item.parentElement;
                let index = Array.from(parent.childNodes).indexOf(item);
                parent.childNodes[index].remove();               
                parent.insertBefore(newNodesContainer, parent.childNodes[index]);
            }
        });
    }

    manualInterpolation (node, value) {
        let childContent = node.innerHTML;
        let interpolated = this.interpolate(childContent, value);
        node.innerHTML = interpolated;
        return node;
    }

    observeContainerChanges(observableTarget) {
        const config = { attributes: true, childList: false, subtree: false, attributeOldValue: true };
        const protectedAttributes = ['draggable', 'style', 'component-id'];
        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (protectedAttributes.indexOf(mutation.attributeName) !== -1 || (observableTarget.attributes[mutation.attributeName] && observableTarget.attributes[mutation.attributeName].value === mutation.oldValue))
                    continue;
                let camelCasedAtt = this._camelCaseAttr(mutation.attributeName);
                this[camelCasedAtt] = observableTarget.attributes[mutation.attributeName]
                    ? typeCast(observableTarget.attributes[mutation.attributeName].value)
                    : null;
            }
        }
        const parentObserver = new MutationObserver(callback);
        parentObserver.observe(observableTarget, config);
    }

    getAttributes () {
        let attributes = this.getAttributeNames();
        const protectedAttributes = ['component', 'component-id', 'repeat'];
        attributes.forEach(att => {
            let camelCasedAtt = att.replace(/-([a-z])/g, (x, up) => up.toUpperCase());
            if (!protectedAttributes.includes(att))
                this[camelCasedAtt] = typeCast(this.getAttribute(att));
        });
    }

    loader (path, fileName) {
        return fileLoader(path, fileName);
    }

    _getProp (prop, context) {
        try {
            let split = prop.indexOf('.');
            if (split === -1)
                return context ? context[prop] : undefined;
    
            let firstPart = prop.substring(0, split);
            let value = this._getProp(prop.substring(split + 1), context[firstPart]);
            return value !== undefined ? value : undefined;
        } catch {
            return undefined;
        }
    }

    _getPointer (propertyName, context) {
        let split = propertyName.split('.');
        let pointer = context;
        if (split[0] === 'this')
            split.shift();
        while (split.length > 0) {
            pointer = pointer[split.shift()];
        }
        return pointer;
    }

    _camelCaseAttr (attrName) {
        return attrName.replace(/-([a-z])/g, (x, up) => up.toUpperCase());
    }

    _setRefs (DOMSource) {
        let refs = Array.from(DOMSource.querySelectorAll('[ref]'));
        refs.forEach(item => {
            let pointer = item.getAttribute('ref');
            this[pointer] = item;
        });
    }

    _templateCleanup (str) {
        return WebComponent.cleanUpTemplate(str);
    }

    remove () {
        this.onRemoved();
        super.remove();
    }

    _listenToCSSLoading () {
        this.priv.cssLink = this.shadowRoot.querySelector('link[rel=stylesheet]');
        if(this.priv.cssLink)
            this.priv.cssLink.addEventListener('load', this.cssOnLoad);
    }

    dump () {
        this.priv.active = false;
        while (this.shadowRoot.childElementCount > 0) {
            this.shadowRoot.lastChild.remove();
        }
        this.onRemoved();
    }

    // CUSTOM CALLBACKS

    onBeforeTemplateLoaded () { // Callback for actions JUST BEFORE template being fetched
    }

    onTemplateLoaded () { // Callback for actions JUST AFTER template was fetched and before rendering
    }
    
    onTemplateRendered () { // Callback for actions once Template has been loaded and added to the Shadow DOM
    }

    onComponentRenderedAgain () { // Callback for actions once component has been re-rendered, even if there are no changes
    }

    onCSSLoaded () {// Callback for actions once CSS is fully loaded and parsed
    }

    onRemoved () { // Callback for actions to run when component has been removed from the DOM.
        CustomEventsManager.removeAllListenersForContext(this);
        this.priv.active = false;
        WebComponent.unlistComponent(this);
    }

    onActiveStatusChanged (newVal, oldVal) {
    }

    cssOnLoad () { // Callback to notify the component that its CSS has been loaded
        this.priv.cssIsLoaded = true;
        this.onCSSLoaded();
    }

    static async registerComponentTemplate (className, tagName, templatePath, templateName) {
        let template = await fileLoader(templatePath, templateName);
        template = this.cleanUpTemplate(template);
        WebComponent.saveToRegistry(className, tagName, template);
        return template;
    }

    static saveToRegistry(className, tagName, template) {
        if (!this.registry) this.registry = {};

        if(this.registry[className]) return;

        this.registry[className] = {
            tagName: tagName.toLowerCase(),
            template: template
        }
    }

    static listComponent (component) {
        if (!this.componentList) this.componentList = new Set();

        this.componentList.add(component);
        return this.componentList.size;
    }

    static unlistComponent (component) {
        if (!this.componentList) return;

        this.componentList.delete(component);
    }

    static getTemplateFromRegistry(className) {
        return this.registry && this.registry[className]
            ? this.registry[className].template
            : null;
    }

    static cleanUpTemplate (str) {
        str = str.replace(/<!--[\s\S]*?-->/g, ''); // No comments
        str = str.replace(/(^\s+|\n|)/gm, '') // no unnecessary whitespace
        return str;
    }
}

window.WebComponent = WebComponent;
