/**
 * Clone the source object to a new one.
 * The Cloned Ojbect and the Source Object will have the same value but different reference (no pointer sharing)
 * @param  {object} objSource - Target Object that need to be cloned from
 * @return {object} a clone object that has the same value with objSource, but different references.
 */
 export function deepClone (objSource) {
	let objClone;
	if (Array.isArray(objSource)) {
		objClone = [];
		objSource.forEach((value, index) => {
			let clonedVal = deepClone(value);
			objClone.push(clonedVal);
		});
	} else if (objSource !== null && typeof objSource === 'object') {
		objClone = {};
		for (var property in objSource) {
			if (objSource.hasOwnProperty(property)) {
				objClone[property] = deepClone(objSource[property]);
			}
		}
	} else {
		objClone = objSource;
	}
	return objClone;
 }

 /**
* Deep merge the enumerable properties from source into target.
* When an object type is an Array and its counterpart is a literal object, the target is ovewrited.
* It's implemented with a Stack instead of recursive calls, and checks for circular references :).
* @param {object} target - Target Object that needs to be merged
* @param {object} source - Source Object.
* @param {keepReferences} source - If it's true, any object existing in source is copy as a reference. Default: false.
* @return {void}
*/
export function deepMerge (target, source, keepReferences = false) {
	let jobsStack = [{target: target, source: source}];
	let visited = [];
	let addJob = (key, tgt, src) => {
		jobsStack.push({target: tgt[key],
			source: src[key],
			parent: {key: key, target: tgt}
		});
	}
	let isContainer = e => e !== null && typeof e === 'object' && !(e instanceof String || e instanceof Number);
	do {
		let job = jobsStack.pop();
		if (!visited.find(e => e.source === job.source)) { // check for circular references
			Object.keys(job.source).forEach(k => {
				if (!isContainer(job.source[k])) {
					job.target[k] = job.source[k];
				} else if (!isContainer(job.target[k])) {
					if (keepReferences) {
						job.target[k] = job.source[k];
					} else {
						if (!job.target[k]) {
							job.target[k] = Array.isArray(job.source) ? [] : {};
						}
						addJob(k, job.target, job.source);
					}
				} else {
					if (job.target[k] !== job.source[k] || !keepReferences) { // Only keep digging if the objects are not the same or we need a full copy.
						if (Array.isArray(job.target[k]) !== Array.isArray(job.source[k])) { // If one is an array but the other not (both are objects here), just overwrite target.
							job.target[k] = Array.isArray(job.source) ? [] : {};
						}
						addJob(k, job.target, job.source);
					}
				}
			});
			visited.push(job);
		} else {
			job.parent.target[job.parent.key] = job.target; // if it's circular in source, should be circular in target.
		}
	} while (jobsStack.length > 0);
}
