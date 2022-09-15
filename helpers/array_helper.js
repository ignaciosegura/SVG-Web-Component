export function makeIntoArrayIfNeeded (source) {
    try {
        return source instanceof Array
            ? source
            : [...Array(Number(source)).keys()];
    } catch (e) {
        console.error(e, source);
    }
}

export function areThoseArraysTheSame (arr1, arr2) {
    return arr1.every((el, index) => el === arr2[index]) && arr1.length === arr2.length;
}

export function checkDifferencesBetweenTwoArrays (oldArr, newArr) {
    let length = Math.max(oldArr.length, newArr.length);
    let diffOperationList = [];

    for (let i = 0; i < length; i++) {
        if (oldArr[i] === undefined && newArr[i] !== undefined) {
            diffOperationList.push('add');
        } else if (oldArr[i] !== undefined && newArr[i] === undefined) {
            diffOperationList.push('remove');
        } else if (oldArr[i] !== newArr[i]) {
            diffOperationList.push('update');
        } else {
            diffOperationList.push('same');
        }
    }
    return diffOperationList;
}
