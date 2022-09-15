import { makeIntoArrayIfNeeded } from '../../helpers/array_helper.js';
// import { time, timeLog } from '../../helpers/time_log.js';

class SVGComponentSpawnClass {
    constructor () {
        this.init();
    }

    init () {
        this.registry = {};
        this.list = [];
        this.counter = 0;

        // this.timer = 'SVG TIMER';
        // time(this.timer);
        // timeLog(this.timer, 'baseline');
    }

    reset () {
        this.list.forEach(item => {
            if (item.removeFromDOM instanceof Function)
                item.removeFromDOM();
        });
        this.init();
    }

    bootSVGWebComponent (tagName, className, context) {
        customElements.define(tagName, className);
        this.registry[className.name] = {
            componentName: tagName,
            template: null
        }
        let items = document.querySelectorAll(`[component=${tagName}]`);
        if (items.length === 0)
            items = document.querySelectorAll(tagName);
        
        if (items.length === 0)
            return false;
    
        items.forEach(item => {
            this.spawnSVGWebComponent(tagName, item, context);
        });

        // // load any items that loaded before things were loaded.
        // this.bootupInactiveChildSVGComponents(document);
    }

    bootupInactiveChildSVGComponents (searchNode, parentInstance) {
        let components = searchNode.querySelectorAll('[component]');
        let compPromises = [];

        Array.from(components).forEach(item => {
            if (item.childElementCount !== 0)
                return Promise.resolve();

            let tagName = item.attributes.component.value;
            let spawnedComponents = this.spawnSVGWebComponent(tagName, item, parentInstance);
            Promise.all(spawnedComponents).then(() => {
                compPromises.push(...spawnedComponents.map(i => i.templateLoaded));
            });
        });

        return compPromises.length > 0
            ? Promise.all(compPromises)
            : Promise.resolve();
    }
          

    spawnSVGWebComponent (tagName, item, context) {
        let repeatItems = this._spawnRepeater(item, context);
        return repeatItems
            ? repeatItems.map(i => this._spawnChild(tagName, i))
            : [this._spawnChildProm(tagName, item)];
    }

    _spawnRepeater (parent, context) {
        let repeaterName = parent.getAttribute('repeat');
        if (repeaterName === null)
            return;
        
        let repeaterArr = isNaN(repeaterName)
            ? makeIntoArrayIfNeeded(context[repeaterName])
            : makeIntoArrayIfNeeded(repeaterName);
        
        let attrNames = parent.getAttributeNames();
        let repeaterTarget = this.findRepeaterTargetAttribute(parent);

        return this._spawnRepeatInstances(parent, repeaterArr, attrNames, repeaterTarget);
    }

    _spawnRepeatInstances (parent, repeaterSource, attrNames, repeaterTarget) {
        if (repeaterSource === undefined)
            return [];

        let instances = [];
        let repeaterArr = makeIntoArrayIfNeeded(repeaterSource);

        repeaterArr.forEach((iterationValue, index) => {
            let instance = this._spawnOneRepeatInstance(parent, attrNames, repeaterTarget, iterationValue, index);
            instances.push(parent.appendChild(instance));
        });
        return instances;
    }

    _spawnOneRepeatInstance (parent, attrNames, repeaterTarget, iterationValue, index) {
        let instance = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        for (const a of attrNames) {
            switch (a) {
                case 'repeat':
                    continue;
                case 'index':
                    instance.setAttribute(a, index);
                    continue;
                case repeaterTarget:
                    instance.setAttribute(a, iterationValue);
                    continue;
                default:
                    instance.setAttribute(a, parent.getAttribute(a));
            }
        }
        return instance;
    }
    
    _spawnChildProm (tagName, parentContainer) {
        let interval;
        let newElementPromise = new Promise((resolve, reject) => {
            if (customElements.get(tagName)) {
                resolve(this._spawnChild(tagName, parentContainer));
            } else {
                interval = setInterval(() => {
                    if (customElements.get(tagName)) {
                        clearInterval(interval);
                        resolve(this._spawnChild(tagName, parentContainer));
                    }
                }, 20);
            }
        });

        return newElementPromise;
    }

    _spawnChild (tagName, parentContainer) {
        let newElement = document.createElement(tagName);
        newElement.parentContainer = parentContainer;
        newElement.getContainerAttributes();
        newElement.priv.componentName = tagName;
        newElement.priv.componentID = this.counter;
        newElement.priv.componentLocator = tagName + '-' + this.counter;
        this.list.push(newElement);
        parentContainer.setAttribute('component-id', this.counter++);
        return newElement;
    }
    
    // This function returns an SVG Web Component that is ALREADY in the scene.
    // It doesn't matter if it's inside a web component, it finds it anyway.
    // Notice that it looks for its component name ("my-component"), not its class name ("myComponent").
    locateSVGWebComponentsByName(searchString) {
        let result = this.list.filter(item => item.priv.componentLocator.indexOf(searchString) !== -1);
    
        switch(result.length) {
            case 0:
                return null;
            case 1:
                return result[0];
            default:
                return result;
        }
    }

    locateAllSVGComponentsInsideDOMNode (node) {
        let nodeList = Array.from(node.querySelectorAll('g[component-id]'));
        let nodeIdList = nodeList.map(item => {
            let tagName = item.getAttribute('component');
            let id = item.getAttribute('component-id');
            return tagName + '-' + id;
        })
        return this.list.filter(item => {
            return nodeIdList.includes(item.priv.componentLocator);
        });
    }

    locateAllChildRepeaters (node) { // It excludes children of children
        let repeaters = Array.from(node.querySelectorAll('[component][repeat]'));
        return repeaters.filter(item => {
            return node.isSameNode(item.parentElement.closest('[component]'));
        });
    }

    locateAllRepeatedSVGComponentsInsideDOMNode (node) {
        let componentName = node.attributes.component.value;
        let nodeList = this.locateAllSVGComponentsInsideDOMNode(node);
        let instanceList = nodeList.filter(item => item.component === componentName);

        return instanceList;
    }

    areAllComponentsReady (componentName) {
        let searchList = componentName
            ? this.list.filter(item => item.component === componentName)
            : this.list;
        return searchList.every(item => item.priv && item.priv.ready);
    }

    findRepeaterTargetAttribute (target) {
        let attrNames = target.getAttributeNames();
        return attrNames.filter(idx => target.getAttribute(idx) === 'repeat')[0] || null;
    }

    reconnectAllComponents () {
        this.list.forEach(item => {
            item.priv.active = true;
        });
    }

    disconnectAllComponents () {
        this.list.forEach(item => {
            item.priv.active = false;
        });
    }

    wipeOutAllComponentsNotInDOM () {
        let toWipe = this.list.filter(item => item.parentContainer.parentElement.parentElement === null);
        for (let i in toWipe) {
            toWipe[i].remove();
        }
    }
}

export var SVGComponentSpawn = new SVGComponentSpawnClass();
window.SVGComponentSpawn = SVGComponentSpawn;
