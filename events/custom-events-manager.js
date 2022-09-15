// This class was written to manage the many custom events we're using inside Learn
// to let Learn components know what is happening around them.
class CustomEventsManagerClass {
    constructor () {
        this.eventList = [];
        this.eventsFired = [];
    }

    addListener (eventName, context, callback) {
        if (!context || !callback)
            throw 'Wrong parameters, can\'t assign custom event';

        this.removeListener(eventName, context); // Cleanup, avoid duplicates

        let eventObj = {
            name: eventName,
            context: context,
            callback: callback.bind(context)
        };
        this.eventList.push(eventObj);
        document.addEventListener(eventName, eventObj.callback);
    }

    addOneTimeListener (eventName, context, callback) {
        let newCallback = e => {
            callback.bind(context)(e);
            this.removeListener(eventName, context);
        }
        this.addListener(eventName, context, newCallback);
    }

    addRetrospectiveListener (eventName, context, callback) {
        if (this.eventHasBeenFiredBefore(eventName))
            callback.bind(context)();

        this.addListener(eventName, context, callback);
    }

    addOneTimeRetrospectiveListener (eventName, context, callback) {
        if (this.eventHasBeenFiredBefore(eventName)) {
            callback.bind(context)();
        } else {
            this.addOneTimeListener(eventName, context, callback);
        }
    }

    removeListener (eventName, context) {
        let index = this.eventList.findIndex(item => {
            let contextIsDOM = context instanceof Element;
            return eventName === item.name && Object.is(context, item.context) && (!contextIsDOM || context.isSameNode(item.context));
        });

        if (index === -1)
            return;

        let eventObj = this.eventList[index];
        document.removeEventListener(eventName, eventObj.callback);
        this.eventList.splice(index, 1);
    }

    removeAllListenersForContext (context) {
        let indexes = [];
        let eventsRemoved = [];
        this.eventList.filter((item, idx) => {
            if (Object.is(context, item.context)) {
                indexes.push(idx);
                return true;
            }
        });

        while (indexes.length > 0) {
            let idx = indexes.pop();
            let e = this.eventList[idx];
            eventsRemoved.push(e.name);
            document.removeEventListener(e.name, e.callback);
            this.eventList.splice(idx, 1);
        }
        
        return eventsRemoved;
    }

    findAllEventsForContext (context) {
        return this.eventList.filter(item => Object.is(context, item.context));
    }

    dispatch (eventName, extraInfo) {
        const detail = typeof extraInfo === 'object'
            ? extraInfo
            : null;
        let eventObj = new CustomEvent(eventName, { detail: detail });
        document.dispatchEvent(eventObj);
        this.listFiredEvent(eventName);
    }

    listFiredEvent (eventName) {
        if (!this.eventHasBeenFiredBefore())
            this.eventsFired.push(eventName);
    }

    eventHasBeenFiredBefore (eventName) {
        return this.eventsFired.indexOf(eventName) !== -1;
    }
}

export const CustomEventsManager = new CustomEventsManagerClass();
window.CustomEventsManager = CustomEventsManager;
