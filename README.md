SVG Web Component
=================

# What is it?

A set of classes and utility functions that let you build a SVG scene and manage complex, nested SVG objects as if they were web components, including most of its advantages and the percs of a modern JS framework: templates, observables, reactive re-rendering and so on.

## Please notice: I developed this library for as long as it was needed. It's fully functional in its current state, but it's no longer being actively developed.

# What problem does it solve?

Web Components don’t work inside SVGs. SVGs exist in their own namespace and web components inside them don’t exist for the browser. The browser doesn’t “see” a web component tag when it’s inside an SVG and therefore doesn’t activate or render it. Thisisnota bug, it's part of the specification, and so far there is no intention to change that, so if we want SVG and modern browser features, we need to code them ourselves.

## Why can’t we draw everything in HTML and use little pieces of SVG instead?

The problem is: the camera. SVGs can have their own set of coordinates for internal use. So a 40x40 pixels SVG can measure things internally at 100x100 pixels.

```<svg x=”0” y=”0” width=”40” height=”40” viewBox=”0 0 100 100”></svg>```

By manipulating this internal set of coordinates in real time, we can move the viewport around the scene, zoom in, zoom out. This is not the fastest way to do it, but it’s the only one that keeps things sharp the whole time (you can see a test here: https://ignaciosegura.github.io/circlelab/).

# What features does it have?

Besides the ability to have something similar to Web Components, we get the following features that go beyond vanilla web components:

- Templates.
- Every Component can have its own CSS file.
- Rerendering a component when an observed value changes.
- Fast DOM rendering. Only DOM nodes or attributes that change are actually changed, saving the browser a lot of repaints.
- Repeaters, or loops inside templates for repeating components.
- Observable variables and properties.
- The ability to delay,group and custom-invoke a re-rendering. Avoid unnecesary changes, re-renders andrepaints is by far the best way to improve performance.
- Lifecycle callbacks similar to the ones in React or Aurelia.

# How do I use SVGWebComponent

## How do I make a new Component

First, you need to declare and boot up a SVG Web Component:

```
import { SVGWebComponent } from "../../../js/learn/svg-web-component.js"
export class MyComponent extends SVGWebComponent {
    [your code here]
}

SVGWebComponent.bootSVGWebComponent('my-component', MyComponent);
```

Second, you need to include it in the root of the scene. You can’t use “script” tags inside SVG, so it has to be at the HTML container level. In this case, “learn.html”. For example:

<script type="module" src="./views/learn/elements/my-element.js"></script>

Third, you need to create an HTML template, an optional CSS file and tell the component where to find them. For example:

```
import { SVGWebComponent } from '../../../js/learn/svg-web-component.js';
export class MyComponent extends SVGWebComponent {
    constructor() {
        super('./views/learn/elements', my-component.html', my-component.css');
    }
}

SVGWebComponent.bootSVGWebComponent('my-component', MyComponent);
```

A template can use custom values using a syntax that is very similar to Aurelia. Example:

<circle id="assignments-button" class="home-button clickable ${this.buttonsState.assignments ? 'active' : ''}" cx="450" cy="130" r="${ 40 / 2 }" fill="green"></circle>

The only difference is that, in order to add logic to the template, you need to include “this”. You can only omit “this” when it’s a direct assignment. For example:

width=”${containerWidth}”
How do I insert a Component in a scene

Instead of custom tags, we use the native SVG tag “g”:

<g component="my-component"></g>

We can pass values to the component using attributes the same way we did in Aurelia, although we do this much less now and there are limitations.

<g component="my-component" attribute="value"></g>

Please notice, you can’t pass entire objects or arrays using this method. All values are automatically typecasted to boolean, string or number.

Another thing worth considering is that, unlike Aurelia, we don’t automatically watch everything that is in a template for performance reasons. Changing a value that is used in a template won’t re-render the template and it won’t propagate its value automatically. You need to make a value “observable”. For that reason, the “makeObservable” helper function was created. More on this later.
How do I make a repeating component

Sometimes we need a component to render more than once, following the values of an array or a fixed number. In such cases, we use the “repeat” attribute, but this works in a different way than in Aurelia. We use “repeat” to pass the array or the number of repetitions, and we optionally pass the value of every iteration to an attribute. For example, to render a level block in Bridge:

<g component="bridge-level" repeat="levelsInThisGame" level="repeat" game="${gameIndex}"></g>

We are specifying here that this component needs to be repeated. How many times? We take that information from “levelsInThisGame”, which is actually “this.levelsInThisGame”, and it’s a number. If it was an array, we’d use the array’s length. We want to pass the level index to every instance of the Level Bridge component, so we use the keyword “repeat” on the attribute level.

In this example, gameIndex is an inherited fixed number value.

You can also use repeaters on things that are not components, such as images. For example:

<image class="puzzle-piece" href="images/learn/bridge/bridge-puzzle-piece.svg" x="${pieceX}" y="330" width="20" height="20" repeat="piecesTotal" />
Does a SVG Component have lifecycle callbacks?

Yes, but not the same ones as a normal Web Component. We created a series of custom callbacks instead:

- **onBeforeTemplateLoaded** - Before loading the template file
- **onTemplateLoaded** - Template was loaded, but not rendered
- **onTemplateRendered** - Template was rendered for first time and inserted into the DOM
- **onActiveStatusChanged** - Components can be signaled to deactivate themselves to save CPU. This callback is invoked every time “active” status changes.
- **onRemoved** - Component is being deleted from the DOM.

## How do I watch a variable for changes?

First, include the “makeObservable” method in your component.

```import { makeObservable } from '../../../js/learn/helpers/make-observable.js'```

Then, after setting things up, watch a property and declare callbacks. Example:

```makeObservable(this, 'buttonState', true)```

Parameters are, in order:

- Context for the variable and the callbacks. Usually “this”.
- Property name (string).
- Re-render (bool). Should we re-render after a change is made? Notice that new and old values are compared, so if the new value is the same as the old one, no re-render will happen in any case.
- Change callback (string or function): Optional custom change callback. If you pass the function instead of its name as a string, remember to bind the context: this.myFunction.bind(this)

Notice that if no change callback is declared, the default ```this.propertyNameChanged(newValue, oldValue)``` will be looked for, just like Aurelia. Besides that, you can have no change callback at all. If the property changes its value and no change callback is found, it will just go to the re-rendering step.

You can delay a render until everything is ready by setting the “re-render” parameter to false for everything except a variable that is last in the processing chain.

## Can I observe the same value from different components?

Yes, you can. Any object property can be “under watch” from different points.

A custom events manager has been created so we can “set and forget” a listener. By using this ```CustomEventsManager```, you don’t need to worry about binding context to the callbacks, or removing listeners. You just set and done.

```CustomEventsManager.addListener(event-to-listen-to, context, callback)```

Example:

​​```CustomEventsManager.addListener(customEventName, this, this.callbackWithBoundContext)```

This custom events manager can be used for any custom event, not only the MainStore ones, as long as the event propagates to document. The BridgeStore also uses it, both for init and for reboot actions.
