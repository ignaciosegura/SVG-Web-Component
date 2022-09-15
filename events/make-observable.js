export const OBSERVABLE_PREFIX = '__';

// Renderfunc parameter is for internal use only in recursive calls.
// Using it on our own code is NOT recommended.
export function makeObservable (target, propertyName, render = true, changeCallback, renderFunc) {
    renderFunc = render === true
        ? renderFunc || target.scheduleRender.bind(target) || null
        : false;
    if (target[propertyName] instanceof Array) {
        makeObservableArray(target, propertyName, changeCallback, renderFunc);
    } else if(target[propertyName] instanceof Object) {
        for(let objectProp in target[propertyName]) {
            makeObservable(target[propertyName], objectProp, render, changeCallback, renderFunc);
        }
    } else {
        makeOnePropertyObservable(target, propertyName, changeCallback, renderFunc);
    }
}

export function removeObservable(target, propertyName, changeFunction) {
    let split = propertyName.split('.');
    let pointer = target;
    let prop = split.pop();
    while (split.length > 0) {
        pointer = pointer[split.shift()];
    }

    let middleMan = OBSERVABLE_PREFIX + prop;
    if (!pointer || !pointer[middleMan]) return;

    changeFunction = changeFunction || `${prop}Changed`;
    let indx = pointer[middleMan].callbacks.findIndex(callback => {
        return Object.is(callback.target, target) && changeFunction === callback.method;
    });
    if (indx >= 0) {
        pointer[middleMan].callbacks.splice(indx, 1);
    } else {
        // makeOnePropertyObservable saves callbacks differently, lets check if its there
        const indices = [];
        pointer[middleMan].callbacks.forEach((item, indx) => {
            // we allow strings to be passed in as listeners, this is to check strings instead of scope of fns and fns
            const compareStrings = typeof changeFunction === 'string';
            const savedFn = compareStrings ? changeFunction : typeof item.method === 'string' ? item.target[item.method] : item.method;

            if (savedFn === changeFunction && Object.is(target, item.target)) {
                indices.push(indx);
            }
        });

        while(indices.length) {
            pointer[middleMan].callbacks.splice(indices.pop(), 1);
        }
    }

    if (!target.scheduleRender)
        return;

    indx = pointer[middleMan].renderFuncs.findIndex(renderObj => {
        return Object.is(renderObj.target, target) && target.scheduleRender instanceof Function;
    });
    if (indx >= 0) {
        pointer[middleMan].renderFuncs.splice(indx, 1);
    }
}

export function makeOnePropertyObservable (target, propertyName, changeCallback, renderFunc) {
    let split = propertyName.split('.');
    let pointer = target;
    let prop = split.pop();
    while (split.length > 0)
        pointer = pointer[split.shift()];

    let middleMan = OBSERVABLE_PREFIX + prop;
    const hasBeenDefined = pointer[middleMan] !== undefined;
    if (!hasBeenDefined) {
        pointer[middleMan] = {
            value: pointer[prop],
            callbacks: [],
            renderFuncs: [],
        };
    }

    changeCallback = changeCallback || `${prop}Changed`;

    if (!callbackAlreadyExists(target, pointer[middleMan], changeCallback))
        pointer[middleMan].callbacks.push({ target: target, method: changeCallback });
    if(renderFunc && !renderFunctionAlreadyExists(target, pointer[middleMan]))
        pointer[middleMan].renderFuncs.push({ target: target, method: renderFunc });

    if (hasBeenDefined) return;

    Object.defineProperty(pointer, prop, {
        get: function () {
            return pointer[middleMan].value;
        },
        set: function (value) {
            if (value === pointer[middleMan].value)
                return;

            let oldValue = pointer[middleMan].value;
            pointer[middleMan].value = value;

            pointer[middleMan].callbacks.forEach(callback => {
                fireChangeCallback(callback.target, callback.method, value, oldValue);
            });
            pointer[middleMan].renderFuncs.forEach(r => {
                fireRenderFunction(r.method);
            });

        }
    });
}

export function cloneObjectIgnoringObservables (target) {
    let clone = {};
    for (let prop in target) {
        if (prop.indexOf(OBSERVABLE_PREFIX) === 0)
            continue;

        if (target[prop] instanceof Array) {
            clone[prop] = target[prop].map(item => {
                return item instanceof Object
                    ? cloneObjectIgnoringObservables(item)
                    : item;
            });
            continue;
        }

        clone[prop] = target[prop] instanceof Object
            ? cloneObjectIgnoringObservables(target[prop])
            : target[prop];
    }
    return clone;
}


/* Internal helper functions */
function callbackAlreadyExists(context, pointer, changeCallback) {
    return pointer.callbacks.some(callback => {
        return Object.is(callback.target, context) && callback.method === changeCallback;
    });
}

function renderFunctionAlreadyExists(context, pointer) {
    return pointer.renderFuncs.some(renderFunc => {
        return Object.is(renderFunc.target, context) && context.scheduleRender instanceof Function;
    });
}

function makeObservableArray (context, propertyName, changeCallback, renderFunc) {
    changeCallback = changeCallback || `${propertyName}Changed`;
    var proxy = new Proxy(context[propertyName], {
        apply: function(target, thisArg, argumentList) {
          return thisArg[target].apply(this, argumentList);
        },
        deleteProperty: function(target, property) {
            fireChangeCallback(context, changeCallback, null, property);
            fireRenderFunction(renderFunc);
            return true;
        },
        set: function (target, property, value, receiver) {
            let oldValue = context[property];
            target[property] = value;
            fireChangeCallback(context, changeCallback, value, oldValue);
            fireRenderFunction(renderFunc);
            return true;
        }
    });
    context[propertyName] = proxy;
}

function fireChangeCallback (target, changeCallback, value, oldValue) {
    if (changeCallback instanceof Function) {
        changeCallback(value, oldValue);
    } else if (target[changeCallback]) {
        target[changeCallback](value, oldValue);
    }
}

function fireRenderFunction (renderFunc) {
    if (renderFunc instanceof Function)
        renderFunc();
}
