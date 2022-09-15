export function fileLoader(path, fileName) {
    return fetch(path + '/' + fileName).then(response => response.text());
}
