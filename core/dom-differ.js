export class domDiffer {
    static render(incoming, current) {
        // Get arrays of child nodes
        var currentNodes = Array.prototype.slice.call(current.childNodes);
        var incomingNodes = Array.prototype.slice.call(incoming.childNodes);
        var outputStats = {
            added: [],
            attributes: [],
            removed: [],
            updated: [],
            replaced: [],
            childrenAdded: []
        }
    
        // If extra elements in DOM, remove them
        var count = currentNodes.length - incomingNodes.length;
        if (count > 0) {
            for (; count > 0; count--) {
                let target = currentNodes[currentNodes.length - count];
                outputStats.removed.push(target);
                target.parentNode.removeChild(target);
            }
        }
    
        // Diff each item in the incomingNodes
        incomingNodes.forEach(function (node, index) {
    
            // If element doesn't exist, transfer it
            // Original script cloned the node, but we want to transfer it to the real DOM instead,
            // in order to keep the state for the associated Web Component
            if (!currentNodes[index]) {
                outputStats.added.push(node);
                current.appendChild(node);
                return;
            }
    
            // If element is not the same type, replace it with new element
            if (getNodeType(node) !== getNodeType(currentNodes[index])) {
                outputStats.replaced.push(node);
                currentNodes[index].parentNode.replaceChild(node.cloneNode(true), currentNodes[index]);
                return;
            }
    
            // If content is different, update it
            var incomingContent = getNodeContent(node);
            if (incomingContent && incomingContent !== getNodeContent(currentNodes[index])) {
                outputStats.updated.push(incomingContent);
                currentNodes[index].textContent = incomingContent;
            }
    
            // If target element should be empty, wipe it
            if (currentNodes[index].childNodes.length > 0 && node.childNodes.length === 0 && !currentNodes[index].hasAttribute('component')) {
                outputStats.removed.push(currentNodes[index].childNodes);
                domDiffer.wipeChildren(currentNodes[index]);
                return;
            }
    
            // If element is empty and shouldn't be, build it up
            // This uses a document fragment to minimize reflows
            if (currentNodes[index].childNodes.length < 1 && node.childNodes.length > 0) {
                var fragment = document.createDocumentFragment();
                domDiffer.render(node, fragment);
                currentNodes[index].appendChild(fragment);
                outputStats.childrenAdded.push(fragment);
                return;
            }

            // If attributes are different, clone attributes
            if (node.attributes && node.attributes.length > 0)
                outputStats.attributes = domDiffer.diffAttributes(currentNodes[index], node);
    
            // If there are existing child elements that need to be modified, diff them
            if (node.childNodes.length > 0) {
                domDiffer.render(node, currentNodes[index]);
            }    
        });

        return outputStats;

        /**
         * Get the type for a node
         * @param  {Node}   node The node
         * @return {String}      The type
         */
        function getNodeType (node) {
            if (node.nodeType === 3) return 'text';
            if (node.nodeType === 8) return 'comment';
            return node.tagName.toLowerCase();
        };

        /**
         * Get the content from a node
         * @param  {Node}   node The node
         * @return {String}      The type
         */
        function getNodeContent (node) {
            if (node.childNodes && node.childNodes.length > 0) return null;
            return node.textContent;
        };


    };

    /**
     * Get the content from a node
     * @param  {Node}   node The node
     * @return {String}      The type
     */
    static diffAttributes(receiver, incoming) {
        let incomingAttr = Array.from(incoming.attributes);
        let outputStatsAttr = [];
        let untouchables = this._findUntouchables(incoming, incomingAttr);
        incomingAttr.forEach(attribute => {
            if (receiver.getAttribute(attribute.name) !== attribute.value && attribute.name !== 'component-id' && untouchables.indexOf(attribute.name) === -1) {
                receiver.setAttribute(attribute.name, attribute.value);
                outputStatsAttr.push({ name: attribute.name, value: attribute.value, action: 'update' });
            }
        });

        if (receiver.attributes.length > incoming.attributes.length) {
            let receiverAttr = Array.from(receiver.attributes);
            receiverAttr.forEach(attribute => {
                if (!incoming.attributes[attribute.name] && untouchables.indexOf(attribute.name) === -1) {
                    receiver.removeAttribute(attribute.name);
                    outputStatsAttr.push({ name: attribute.name, value: attribute.value, action: 'remove' });
                }
            });
        }
        return outputStatsAttr;
    }

    static _findUntouchables (element, incomingAttr) {
        let untouchableAttr = incomingAttr.find(item => item.name === 'untouchable');
        return untouchableAttr
            ? untouchableAttr.value.split(',').map(item => item.trim())
            : [];
    }

    static renderRepeater (incoming, current) {
        return this.render(incoming, current, true);
    }

    static wipeChildren (node) {
        while (node.childElementCount > 0)
            node.lastChild.remove();
    }
}
