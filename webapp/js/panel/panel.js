import {doT} from '../vendor/dot.js';
import {RestCall} from './rest.js';
import {store} from './store.js';

"use strict";

doT.templateSettings.strip = false;

export function els(sel) {
    return document.querySelectorAll(sel);
}

export function el(sel) {
    return els(sel)[0];
}

// Panel object parent is provided so we can call back and map the event to the store for this panel.
// data is some initial state for the store, it has to be null if you want to trigger the restReq to
// get some initial data from the server.
export function Panel(parent, data, template, attach, events, restReq) {
    // N.B. this.evtHub is set by the controller
    this.store = new store(data);  // the data store to render this panel.
    this.template = template;      // the template to use to render the html from the store data.
    this.attach = attach;          // the CSS selector to attach the resultant html to.
    this.IDs = [];                 // array of ids that uniquely identify this instance of a panel
    this.active = false;           // active is true if we think this panel is in the dom.

    // Compile template function
    this.tempFn = doT.template(template);

    // Activate is called to mark this panel active and render it into the dom.
    // different invocations of the same panel must differentiate with the IDs array.
    this.Activate = function(ids) {
        // if the panel is active and the ids are the same
        if (this.active && (ids==undefined || 
            ids.length==this.IDs.length && ids.every((v,i)=> v === this.IDs[i]))) {
            console.log("allready active", this.IDs)
            return;
        }
        this.IDs = ids;

        console.log("activating", this);

        this.active = true;

        // if this store is empty get the data from the server.
        // if the request is a function then assume its dynamic and call get data every time.
        // TODO possibly consider comparing this and last request and only call if different.
        if (this.store.IsEmpty() || typeof restReq == 'function') {
            this.GetData();
        }

        // render it in even if the data is unchanged, hence true param.
        this.Render(true); 
    }

    this.GetData = function() {
        if (restReq == undefined) {
            return;
        }
        var call = restReq;
        // if the request is a function then call it
        if (typeof restReq == 'function') { 
            call = restReq(); 
        }
        if (call.Method == undefined ){
            call.Method = 'GET';
        }

        RestCall(this.evtHub, call.Method, call.URL, call.ReqBodyObj); 
    }

    this.WipeData = function() {
        this.store.Reset();
    }

    // Deactivate marks this panel as not active. Any subsequent calls to render will return without changing the dom.
    this.Deactivate = function() {
        this.active = false;
    }

    // Notify is called by the controller of this panel with a relevant event
    this.Notify = function(evt) {
        var data = parent.Map(evt, this.store.Get(true));

        var updated = false;
        for (var key in data) {
            console.log("updating", key, data[key]);
            this.store.Update(key, data[key]); // TODO - decide if the data changed
            updated = true;
        }

        this.Render(false); // false asks for a render only if the data changed.
    }

    // Render will re-render the template into the 'attach' selector, only if the data has changed.
    this.Render = function(force) {
        // only render active panels
        if (!this.active) {
            return;
        }
        
        // get the stored data - if it is unchanged it will be null
        var dataIfNew = this.store.Get(force);
        if (dataIfNew == null && !force) {
            return;
        }
        
        // get the template and attach it to its dom element
        var resultText = "";
        if (dataIfNew != null) {
            // the object passed to the template is a combination of stored data and 
            // more persistent data associated with the invocation of this specific panel.
            var data = {
                Obj: {
                    IDs: this.IDs,
                },
                Data: dataIfNew, 
            }

            resultText = this.tempFn(data);
        }
        
        el(attach).innerHTML = resultText; // TODO - trap missing el?

        // This closes around the loop vars in constructing the events below
        function eventHandler(fn, el) {
            return function(evt) {
                evt.preventDefault();
                evt.stopPropagation();
                fn(evt, el);	
            }
         }

        // attach all the events
        var elen = events.length;
        for (var e = 0; e < elen; e++) {
            var ev = events[e];
            var elems = els(ev.El);
            var len = elems.length;
            console.log("adding event:", event, "to:", len, "elems");
            for (var i = 0; i < len; i++) {
                var elem = elems[i];
                elem.addEventListener(ev.Ev, eventHandler(ev.Fn, elem));
            }
        }

        // if the parent wanted to do anything after rendering...
        if (typeof parent.AfterRender == 'function') { 
            parent.AfterRender(data); 
        }

        // TODO - cache the inner html ?
    }
}

export function Store(initial) {
    this.changed = true;
    this.data = initial;

    // Update updates the data at the given key and marks the Store as having a change.
    this.Update = function(key, val) {
        this.data[key] = val;
        this.changed = true;
    }

    // Get returns the data at the given key 
    this.Get = function(force) {
        if (!this.changed && !force) {
            return null;
        }
        this.changed = false;
        return this.data;
    }

    this.TrashAll = function() {
        this.changed = true;
        this.data = null;
    }
}