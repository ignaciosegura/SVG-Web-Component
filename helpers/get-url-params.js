import { typeCast } from "../js/typecast-helper.js";

export class urlParams {
    static getAll () {
        if (this.params)
            return this.params;
        
        const searchString = location.search.replace(/\/$/gm, '');
        const params = new URLSearchParams(searchString);
        this.params = {};
        for (const [key, value] of params.entries()) {
            this.params[key] = typeCast(value);
        };
        return this.params;
    }

    static getParamValue (name) {
        let params = this.params || this.getAll();
        return this.params[name] || undefined;
    }

    static paramIsSet (name) {
        let params = this.params || this.getAll();
        return params[name] !== undefined;
    }

    static getHashRouteAndParams () {
        let params = window.location.hash.split('/');
        let route = params[1];
        params = params.slice(2);

        return {
            route: route,
            params: params.length > 0
                ? params
                : null
        }
    }
}
