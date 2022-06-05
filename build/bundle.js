
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.45.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var __classPrivateFieldSet$f = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$d = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _EventDispatcher_listeners;
    class EventDispatcher {
        constructor() {
            _EventDispatcher_listeners.set(this, void 0);
            __classPrivateFieldSet$f(this, _EventDispatcher_listeners, new Map(), "f");
        }
        addEventListener(type, listener) {
            var _a;
            this.removeEventListener(type, listener);
            if (!__classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").get(type)) {
                __classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").set(type, []);
            }
            (_a = __classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").get(type)) === null || _a === void 0 ? void 0 : _a.push(listener);
        }
        removeEventListener(type, listener) {
            const arr = __classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").get(type);
            if (!arr) {
                return;
            }
            const length = arr.length, idx = arr.indexOf(listener);
            if (idx < 0) {
                return;
            }
            if (length === 1) {
                __classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").delete(type);
            }
            else {
                arr.splice(idx, 1);
            }
        }
        removeAllEventListeners(type) {
            if (!type) {
                __classPrivateFieldSet$f(this, _EventDispatcher_listeners, new Map(), "f");
            }
            else {
                __classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").delete(type);
            }
        }
        dispatchEvent(type, args) {
            var _a;
            (_a = __classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").get(type)) === null || _a === void 0 ? void 0 : _a.forEach((handler) => handler(args));
        }
        hasEventListener(type) {
            return !!__classPrivateFieldGet$d(this, _EventDispatcher_listeners, "f").get(type);
        }
    }
    _EventDispatcher_listeners = new WeakMap();

    class Vector {
        constructor(xOrCoords, y) {
            if (typeof xOrCoords !== "number" && xOrCoords) {
                this.x = xOrCoords.x;
                this.y = xOrCoords.y;
            }
            else if (xOrCoords !== undefined && y !== undefined) {
                this.x = xOrCoords;
                this.y = y;
            }
            else {
                throw new Error("tsParticles - Vector not initialized correctly");
            }
        }
        static clone(source) {
            return Vector.create(source.x, source.y);
        }
        static create(x, y) {
            return new Vector(x, y);
        }
        static get origin() {
            return Vector.create(0, 0);
        }
        get angle() {
            return Math.atan2(this.y, this.x);
        }
        set angle(angle) {
            this.updateFromAngle(angle, this.length);
        }
        get length() {
            return Math.sqrt(this.getLengthSq());
        }
        set length(length) {
            this.updateFromAngle(this.angle, length);
        }
        add(v) {
            return Vector.create(this.x + v.x, this.y + v.y);
        }
        addTo(v) {
            this.x += v.x;
            this.y += v.y;
        }
        sub(v) {
            return Vector.create(this.x - v.x, this.y - v.y);
        }
        subFrom(v) {
            this.x -= v.x;
            this.y -= v.y;
        }
        mult(n) {
            return Vector.create(this.x * n, this.y * n);
        }
        multTo(n) {
            this.x *= n;
            this.y *= n;
        }
        div(n) {
            return Vector.create(this.x / n, this.y / n);
        }
        divTo(n) {
            this.x /= n;
            this.y /= n;
        }
        distanceTo(v) {
            return this.sub(v).length;
        }
        getLengthSq() {
            return this.x ** 2 + this.y ** 2;
        }
        distanceToSq(v) {
            return this.sub(v).getLengthSq();
        }
        manhattanDistanceTo(v) {
            return Math.abs(v.x - this.x) + Math.abs(v.y - this.y);
        }
        copy() {
            return Vector.clone(this);
        }
        setTo(v) {
            this.x = v.x;
            this.y = v.y;
        }
        rotate(angle) {
            return Vector.create(this.x * Math.cos(angle) - this.y * Math.sin(angle), this.x * Math.sin(angle) + this.y * Math.cos(angle));
        }
        updateFromAngle(angle, length) {
            this.x = Math.cos(angle) * length;
            this.y = Math.sin(angle) * length;
        }
    }

    function clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
    }
    function mix(comp1, comp2, weight1, weight2) {
        return Math.floor((comp1 * weight1 + comp2 * weight2) / (weight1 + weight2));
    }
    function randomInRange(r) {
        const max = getRangeMax(r);
        let min = getRangeMin(r);
        if (max === min) {
            min = 0;
        }
        return Math.random() * (max - min) + min;
    }
    function getRangeValue(value) {
        return typeof value === "number" ? value : randomInRange(value);
    }
    function getRangeMin(value) {
        return typeof value === "number" ? value : value.min;
    }
    function getRangeMax(value) {
        return typeof value === "number" ? value : value.max;
    }
    function setRangeValue(source, value) {
        if (source === value || (value === undefined && typeof source === "number")) {
            return source;
        }
        const min = getRangeMin(source), max = getRangeMax(source);
        return value !== undefined
            ? {
                min: Math.min(min, value),
                max: Math.max(max, value),
            }
            : setRangeValue(min, max);
    }
    function getValue(options) {
        const random = options.random, { enable, minimumValue } = typeof random === "boolean"
            ? {
                enable: random,
                minimumValue: 0,
            }
            : random;
        return enable ? getRangeValue(setRangeValue(options.value, minimumValue)) : getRangeValue(options.value);
    }
    function getDistances(pointA, pointB) {
        const dx = pointA.x - pointB.x, dy = pointA.y - pointB.y;
        return { dx: dx, dy: dy, distance: Math.sqrt(dx * dx + dy * dy) };
    }
    function getDistance(pointA, pointB) {
        return getDistances(pointA, pointB).distance;
    }
    function getParticleDirectionAngle(direction, position, center) {
        if (typeof direction === "number") {
            return (direction * Math.PI) / 180;
        }
        else {
            switch (direction) {
                case "top":
                    return -Math.PI / 2;
                case "top-right":
                    return -Math.PI / 4;
                case "right":
                    return 0;
                case "bottom-right":
                    return Math.PI / 4;
                case "bottom":
                    return Math.PI / 2;
                case "bottom-left":
                    return (3 * Math.PI) / 4;
                case "left":
                    return Math.PI;
                case "top-left":
                    return (-3 * Math.PI) / 4;
                case "inside":
                    return Math.atan2(center.y - position.y, center.x - position.x);
                case "outside":
                    return Math.atan2(position.y - center.y, position.x - center.x);
                case "none":
                default:
                    return Math.random() * Math.PI * 2;
            }
        }
    }
    function getParticleBaseVelocity(direction) {
        const baseVelocity = Vector.origin;
        baseVelocity.length = 1;
        baseVelocity.angle = direction;
        return baseVelocity;
    }
    function collisionVelocity(v1, v2, m1, m2) {
        return Vector.create((v1.x * (m1 - m2)) / (m1 + m2) + (v2.x * 2 * m2) / (m1 + m2), v1.y);
    }
    function calcEasing(value, type) {
        switch (type) {
            case "ease-out-quad":
                return 1 - (1 - value) ** 2;
            case "ease-out-cubic":
                return 1 - (1 - value) ** 3;
            case "ease-out-quart":
                return 1 - (1 - value) ** 4;
            case "ease-out-quint":
                return 1 - (1 - value) ** 5;
            case "ease-out-expo":
                return value === 1 ? 1 : 1 - Math.pow(2, -10 * value);
            case "ease-out-sine":
                return Math.sin((value * Math.PI) / 2);
            case "ease-out-back": {
                const c1 = 1.70158, c3 = c1 + 1;
                return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
            }
            case "ease-out-circ":
                return Math.sqrt(1 - Math.pow(value - 1, 2));
            default:
                return value;
        }
    }
    function calcPositionFromSize(data) {
        var _a, _b;
        return ((_a = data.position) === null || _a === void 0 ? void 0 : _a.x) !== undefined && ((_b = data.position) === null || _b === void 0 ? void 0 : _b.y) !== undefined
            ? {
                x: (data.position.x * data.size.width) / 100,
                y: (data.position.y * data.size.height) / 100,
            }
            : undefined;
    }
    function calcPositionOrRandomFromSize(data) {
        var _a, _b, _c, _d;
        return {
            x: (((_b = (_a = data.position) === null || _a === void 0 ? void 0 : _a.x) !== null && _b !== void 0 ? _b : Math.random() * 100) * data.size.width) / 100,
            y: (((_d = (_c = data.position) === null || _c === void 0 ? void 0 : _c.y) !== null && _d !== void 0 ? _d : Math.random() * 100) * data.size.height) / 100,
        };
    }
    function calcPositionOrRandomFromSizeRanged(data) {
        var _a, _b;
        const position = {
            x: ((_a = data.position) === null || _a === void 0 ? void 0 : _a.x) !== undefined ? getRangeValue(data.position.x) : undefined,
            y: ((_b = data.position) === null || _b === void 0 ? void 0 : _b.y) !== undefined ? getRangeValue(data.position.y) : undefined,
        };
        return calcPositionOrRandomFromSize({ size: data.size, position });
    }
    function calcExactPositionOrRandomFromSize(data) {
        var _a, _b, _c, _d;
        return {
            x: (_b = (_a = data.position) === null || _a === void 0 ? void 0 : _a.x) !== null && _b !== void 0 ? _b : Math.random() * data.size.width,
            y: (_d = (_c = data.position) === null || _c === void 0 ? void 0 : _c.y) !== null && _d !== void 0 ? _d : Math.random() * data.size.height,
        };
    }

    class OptionsColor {
        constructor() {
            this.value = "";
        }
        static create(source, data) {
            const color = new OptionsColor();
            color.load(source);
            if (data !== undefined) {
                if (typeof data === "string" || data instanceof Array) {
                    color.load({ value: data });
                }
                else {
                    color.load(data);
                }
            }
            return color;
        }
        load(data) {
            if ((data === null || data === void 0 ? void 0 : data.value) === undefined) {
                return;
            }
            this.value = data.value;
        }
    }

    class Background {
        constructor() {
            this.color = new OptionsColor();
            this.color.value = "";
            this.image = "";
            this.position = "";
            this.repeat = "";
            this.size = "";
            this.opacity = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.color !== undefined) {
                this.color = OptionsColor.create(this.color, data.color);
            }
            if (data.image !== undefined) {
                this.image = data.image;
            }
            if (data.position !== undefined) {
                this.position = data.position;
            }
            if (data.repeat !== undefined) {
                this.repeat = data.repeat;
            }
            if (data.size !== undefined) {
                this.size = data.size;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
        }
    }

    class BackgroundMaskCover {
        constructor() {
            this.color = new OptionsColor();
            this.color.value = "#fff";
            this.opacity = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.color !== undefined) {
                this.color = OptionsColor.create(this.color, data.color);
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
        }
    }

    class BackgroundMask {
        constructor() {
            this.composite = "destination-out";
            this.cover = new BackgroundMaskCover();
            this.enable = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.composite !== undefined) {
                this.composite = data.composite;
            }
            if (data.cover !== undefined) {
                const cover = data.cover;
                const color = (typeof data.cover === "string" ? { color: data.cover } : data.cover);
                this.cover.load(cover.color !== undefined ? cover : { color: color });
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
        }
    }

    class FullScreen {
        constructor() {
            this.enable = true;
            this.zIndex = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.zIndex !== undefined) {
                this.zIndex = data.zIndex;
            }
        }
    }

    class ClickEvent {
        constructor() {
            this.enable = false;
            this.mode = [];
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
        }
    }

    class DivEvent {
        constructor() {
            this.selectors = [];
            this.enable = false;
            this.mode = [];
            this.type = "circle";
        }
        get elementId() {
            return this.ids;
        }
        set elementId(value) {
            this.ids = value;
        }
        get el() {
            return this.elementId;
        }
        set el(value) {
            this.elementId = value;
        }
        get ids() {
            return this.selectors instanceof Array
                ? this.selectors.map((t) => t.replace("#", ""))
                : this.selectors.replace("#", "");
        }
        set ids(value) {
            this.selectors = value instanceof Array ? value.map((t) => `#${t}`) : `#${value}`;
        }
        load(data) {
            var _a, _b;
            if (!data) {
                return;
            }
            const ids = (_b = (_a = data.ids) !== null && _a !== void 0 ? _a : data.elementId) !== null && _b !== void 0 ? _b : data.el;
            if (ids !== undefined) {
                this.ids = ids;
            }
            if (data.selectors !== undefined) {
                this.selectors = data.selectors;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
            if (data.type !== undefined) {
                this.type = data.type;
            }
        }
    }

    class Parallax {
        constructor() {
            this.enable = false;
            this.force = 2;
            this.smooth = 10;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.force !== undefined) {
                this.force = data.force;
            }
            if (data.smooth !== undefined) {
                this.smooth = data.smooth;
            }
        }
    }

    class HoverEvent {
        constructor() {
            this.enable = false;
            this.mode = [];
            this.parallax = new Parallax();
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
            this.parallax.load(data.parallax);
        }
    }

    class Events {
        constructor() {
            this.onClick = new ClickEvent();
            this.onDiv = new DivEvent();
            this.onHover = new HoverEvent();
            this.resize = true;
        }
        get onclick() {
            return this.onClick;
        }
        set onclick(value) {
            this.onClick = value;
        }
        get ondiv() {
            return this.onDiv;
        }
        set ondiv(value) {
            this.onDiv = value;
        }
        get onhover() {
            return this.onHover;
        }
        set onhover(value) {
            this.onHover = value;
        }
        load(data) {
            var _a, _b, _c;
            if (!data) {
                return;
            }
            this.onClick.load((_a = data.onClick) !== null && _a !== void 0 ? _a : data.onclick);
            const onDiv = (_b = data.onDiv) !== null && _b !== void 0 ? _b : data.ondiv;
            if (onDiv !== undefined) {
                if (onDiv instanceof Array) {
                    this.onDiv = onDiv.map((div) => {
                        const tmp = new DivEvent();
                        tmp.load(div);
                        return tmp;
                    });
                }
                else {
                    this.onDiv = new DivEvent();
                    this.onDiv.load(onDiv);
                }
            }
            this.onHover.load((_c = data.onHover) !== null && _c !== void 0 ? _c : data.onhover);
            if (data.resize !== undefined) {
                this.resize = data.resize;
            }
        }
    }

    class Attract {
        constructor() {
            this.distance = 200;
            this.duration = 0.4;
            this.easing = "ease-out-quad";
            this.factor = 1;
            this.maxSpeed = 50;
            this.speed = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = data.distance;
            }
            if (data.duration !== undefined) {
                this.duration = data.duration;
            }
            if (data.easing !== undefined) {
                this.easing = data.easing;
            }
            if (data.factor !== undefined) {
                this.factor = data.factor;
            }
            if (data.maxSpeed !== undefined) {
                this.maxSpeed = data.maxSpeed;
            }
            if (data.speed !== undefined) {
                this.speed = data.speed;
            }
        }
    }

    class Bounce {
        constructor() {
            this.distance = 200;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = data.distance;
            }
        }
    }

    class BubbleBase {
        constructor() {
            this.distance = 200;
            this.duration = 0.4;
            this.mix = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = data.distance;
            }
            if (data.duration !== undefined) {
                this.duration = data.duration;
            }
            if (data.mix !== undefined) {
                this.mix = data.mix;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
            if (data.color !== undefined) {
                if (data.color instanceof Array) {
                    this.color = data.color.map((s) => OptionsColor.create(undefined, s));
                }
                else {
                    if (this.color instanceof Array) {
                        this.color = new OptionsColor();
                    }
                    this.color = OptionsColor.create(this.color, data.color);
                }
            }
            if (data.size !== undefined) {
                this.size = data.size;
            }
        }
    }

    class BubbleDiv extends BubbleBase {
        constructor() {
            super();
            this.selectors = [];
        }
        get ids() {
            return this.selectors instanceof Array
                ? this.selectors.map((t) => t.replace("#", ""))
                : this.selectors.replace("#", "");
        }
        set ids(value) {
            this.selectors = value instanceof Array ? value.map((t) => `#${t}`) : `#${value}`;
        }
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            if (data.ids !== undefined) {
                this.ids = data.ids;
            }
            if (data.selectors !== undefined) {
                this.selectors = data.selectors;
            }
        }
    }

    class Bubble extends BubbleBase {
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            if (data.divs instanceof Array) {
                this.divs = data.divs.map((s) => {
                    const tmp = new BubbleDiv();
                    tmp.load(s);
                    return tmp;
                });
            }
            else {
                if (this.divs instanceof Array || !this.divs) {
                    this.divs = new BubbleDiv();
                }
                this.divs.load(data.divs);
            }
        }
    }

    class ConnectLinks {
        constructor() {
            this.opacity = 0.5;
        }
        load(data) {
            if (!(data !== undefined && data.opacity !== undefined)) {
                return;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
        }
    }

    class Connect {
        constructor() {
            this.distance = 80;
            this.links = new ConnectLinks();
            this.radius = 60;
        }
        get line_linked() {
            return this.links;
        }
        set line_linked(value) {
            this.links = value;
        }
        get lineLinked() {
            return this.links;
        }
        set lineLinked(value) {
            this.links = value;
        }
        load(data) {
            var _a, _b;
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = data.distance;
            }
            this.links.load((_b = (_a = data.links) !== null && _a !== void 0 ? _a : data.lineLinked) !== null && _b !== void 0 ? _b : data.line_linked);
            if (data.radius !== undefined) {
                this.radius = data.radius;
            }
        }
    }

    class GrabLinks {
        constructor() {
            this.blink = false;
            this.consent = false;
            this.opacity = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.blink !== undefined) {
                this.blink = data.blink;
            }
            if (data.color !== undefined) {
                this.color = OptionsColor.create(this.color, data.color);
            }
            if (data.consent !== undefined) {
                this.consent = data.consent;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
        }
    }

    class Grab {
        constructor() {
            this.distance = 100;
            this.links = new GrabLinks();
        }
        get line_linked() {
            return this.links;
        }
        set line_linked(value) {
            this.links = value;
        }
        get lineLinked() {
            return this.links;
        }
        set lineLinked(value) {
            this.links = value;
        }
        load(data) {
            var _a, _b;
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = data.distance;
            }
            this.links.load((_b = (_a = data.links) !== null && _a !== void 0 ? _a : data.lineLinked) !== null && _b !== void 0 ? _b : data.line_linked);
        }
    }

    class LightGradient {
        constructor() {
            this.start = new OptionsColor();
            this.stop = new OptionsColor();
            this.start.value = "#ffffff";
            this.stop.value = "#000000";
        }
        load(data) {
            if (!data) {
                return;
            }
            this.start = OptionsColor.create(this.start, data.start);
            this.stop = OptionsColor.create(this.stop, data.stop);
        }
    }

    class LightArea {
        constructor() {
            this.gradient = new LightGradient();
            this.radius = 1000;
        }
        load(data) {
            if (!data) {
                return;
            }
            this.gradient.load(data.gradient);
            if (data.radius !== undefined) {
                this.radius = data.radius;
            }
        }
    }

    class LightShadow {
        constructor() {
            this.color = new OptionsColor();
            this.color.value = "#000000";
            this.length = 2000;
        }
        load(data) {
            if (!data) {
                return;
            }
            this.color = OptionsColor.create(this.color, data.color);
            if (data.length !== undefined) {
                this.length = data.length;
            }
        }
    }

    class Light {
        constructor() {
            this.area = new LightArea();
            this.shadow = new LightShadow();
        }
        load(data) {
            if (!data) {
                return;
            }
            this.area.load(data.area);
            this.shadow.load(data.shadow);
        }
    }

    class Push {
        constructor() {
            this.default = true;
            this.groups = [];
            this.quantity = 4;
        }
        get particles_nb() {
            return this.quantity;
        }
        set particles_nb(value) {
            this.quantity = value;
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            if (data.default !== undefined) {
                this.default = data.default;
            }
            if (data.groups !== undefined) {
                this.groups = data.groups.map((t) => t);
            }
            if (!this.groups.length) {
                this.default = true;
            }
            const quantity = (_a = data.quantity) !== null && _a !== void 0 ? _a : data.particles_nb;
            if (quantity !== undefined) {
                this.quantity = quantity;
            }
        }
    }

    class Remove {
        constructor() {
            this.quantity = 2;
        }
        get particles_nb() {
            return this.quantity;
        }
        set particles_nb(value) {
            this.quantity = value;
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            const quantity = (_a = data.quantity) !== null && _a !== void 0 ? _a : data.particles_nb;
            if (quantity !== undefined) {
                this.quantity = quantity;
            }
        }
    }

    class RepulseBase {
        constructor() {
            this.distance = 200;
            this.duration = 0.4;
            this.factor = 100;
            this.speed = 1;
            this.maxSpeed = 50;
            this.easing = "ease-out-quad";
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = data.distance;
            }
            if (data.duration !== undefined) {
                this.duration = data.duration;
            }
            if (data.easing !== undefined) {
                this.easing = data.easing;
            }
            if (data.factor !== undefined) {
                this.factor = data.factor;
            }
            if (data.speed !== undefined) {
                this.speed = data.speed;
            }
            if (data.maxSpeed !== undefined) {
                this.maxSpeed = data.maxSpeed;
            }
        }
    }

    class RepulseDiv extends RepulseBase {
        constructor() {
            super();
            this.selectors = [];
        }
        get ids() {
            if (this.selectors instanceof Array) {
                return this.selectors.map((t) => t.replace("#", ""));
            }
            else {
                return this.selectors.replace("#", "");
            }
        }
        set ids(value) {
            if (value instanceof Array) {
                this.selectors = value.map(() => `#${value}`);
            }
            else {
                this.selectors = `#${value}`;
            }
        }
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            if (data.ids !== undefined) {
                this.ids = data.ids;
            }
            if (data.selectors !== undefined) {
                this.selectors = data.selectors;
            }
        }
    }

    class Repulse extends RepulseBase {
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            if (data.divs instanceof Array) {
                this.divs = data.divs.map((s) => {
                    const tmp = new RepulseDiv();
                    tmp.load(s);
                    return tmp;
                });
            }
            else {
                if (this.divs instanceof Array || !this.divs) {
                    this.divs = new RepulseDiv();
                }
                this.divs.load(data.divs);
            }
        }
    }

    class Slow {
        constructor() {
            this.factor = 3;
            this.radius = 200;
        }
        get active() {
            return false;
        }
        set active(_value) {
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.factor !== undefined) {
                this.factor = data.factor;
            }
            if (data.radius !== undefined) {
                this.radius = data.radius;
            }
        }
    }

    class Trail {
        constructor() {
            this.delay = 1;
            this.pauseOnStop = false;
            this.quantity = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.delay !== undefined) {
                this.delay = data.delay;
            }
            if (data.quantity !== undefined) {
                this.quantity = data.quantity;
            }
            if (data.particles !== undefined) {
                this.particles = deepExtend({}, data.particles);
            }
            if (data.pauseOnStop !== undefined) {
                this.pauseOnStop = data.pauseOnStop;
            }
        }
    }

    class Modes {
        constructor() {
            this.attract = new Attract();
            this.bounce = new Bounce();
            this.bubble = new Bubble();
            this.connect = new Connect();
            this.grab = new Grab();
            this.light = new Light();
            this.push = new Push();
            this.remove = new Remove();
            this.repulse = new Repulse();
            this.slow = new Slow();
            this.trail = new Trail();
        }
        load(data) {
            if (!data) {
                return;
            }
            this.attract.load(data.attract);
            this.bubble.load(data.bubble);
            this.connect.load(data.connect);
            this.grab.load(data.grab);
            this.light.load(data.light);
            this.push.load(data.push);
            this.remove.load(data.remove);
            this.repulse.load(data.repulse);
            this.slow.load(data.slow);
            this.trail.load(data.trail);
        }
    }

    class Interactivity {
        constructor() {
            this.detectsOn = "window";
            this.events = new Events();
            this.modes = new Modes();
        }
        get detect_on() {
            return this.detectsOn;
        }
        set detect_on(value) {
            this.detectsOn = value;
        }
        load(data) {
            var _a, _b, _c;
            if (!data) {
                return;
            }
            const detectsOn = (_a = data.detectsOn) !== null && _a !== void 0 ? _a : data.detect_on;
            if (detectsOn !== undefined) {
                this.detectsOn = detectsOn;
            }
            this.events.load(data.events);
            this.modes.load(data.modes);
            if (((_c = (_b = data.modes) === null || _b === void 0 ? void 0 : _b.slow) === null || _c === void 0 ? void 0 : _c.active) === true) {
                if (this.events.onHover.mode instanceof Array) {
                    if (this.events.onHover.mode.indexOf("slow") < 0) {
                        this.events.onHover.mode.push("slow");
                    }
                }
                else if (this.events.onHover.mode !== "slow") {
                    this.events.onHover.mode = [this.events.onHover.mode, "slow"];
                }
            }
        }
    }

    class ManualParticle {
        load(data) {
            var _a, _b;
            if (!data) {
                return;
            }
            if (data.position !== undefined) {
                this.position = {
                    x: (_a = data.position.x) !== null && _a !== void 0 ? _a : 50,
                    y: (_b = data.position.y) !== null && _b !== void 0 ? _b : 50,
                };
            }
            if (data.options !== undefined) {
                this.options = deepExtend({}, data.options);
            }
        }
    }

    class MotionReduce {
        constructor() {
            this.factor = 4;
            this.value = true;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.factor !== undefined) {
                this.factor = data.factor;
            }
            if (data.value !== undefined) {
                this.value = data.value;
            }
        }
    }

    class Motion {
        constructor() {
            this.disable = false;
            this.reduce = new MotionReduce();
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.disable !== undefined) {
                this.disable = data.disable;
            }
            this.reduce.load(data.reduce);
        }
    }

    class Responsive {
        constructor() {
            this.maxWidth = Infinity;
            this.options = {};
            this.mode = "canvas";
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.maxWidth !== undefined) {
                this.maxWidth = data.maxWidth;
            }
            if (data.mode !== undefined) {
                if (data.mode === "screen") {
                    this.mode = "screen";
                }
                else {
                    this.mode = "canvas";
                }
            }
            if (data.options !== undefined) {
                this.options = deepExtend({}, data.options);
            }
        }
    }

    class ThemeDefault {
        constructor() {
            this.auto = false;
            this.mode = "any";
            this.value = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.auto !== undefined) {
                this.auto = data.auto;
            }
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
            if (data.value !== undefined) {
                this.value = data.value;
            }
        }
    }

    class Theme {
        constructor() {
            this.name = "";
            this.default = new ThemeDefault();
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.name !== undefined) {
                this.name = data.name;
            }
            this.default.load(data.default);
            if (data.options !== undefined) {
                this.options = deepExtend({}, data.options);
            }
        }
    }

    var __classPrivateFieldSet$e = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$c = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Options_instances, _Options_engine, _Options_findDefaultTheme;
    class Options {
        constructor(engine) {
            _Options_instances.add(this);
            _Options_engine.set(this, void 0);
            __classPrivateFieldSet$e(this, _Options_engine, engine, "f");
            this.autoPlay = true;
            this.background = new Background();
            this.backgroundMask = new BackgroundMask();
            this.fullScreen = new FullScreen();
            this.detectRetina = true;
            this.duration = 0;
            this.fpsLimit = 120;
            this.interactivity = new Interactivity();
            this.manualParticles = [];
            this.motion = new Motion();
            this.particles = loadParticlesOptions();
            this.pauseOnBlur = true;
            this.pauseOnOutsideViewport = true;
            this.responsive = [];
            this.style = {};
            this.themes = [];
            this.zLayers = 100;
        }
        get fps_limit() {
            return this.fpsLimit;
        }
        set fps_limit(value) {
            this.fpsLimit = value;
        }
        get retina_detect() {
            return this.detectRetina;
        }
        set retina_detect(value) {
            this.detectRetina = value;
        }
        get backgroundMode() {
            return this.fullScreen;
        }
        set backgroundMode(value) {
            this.fullScreen.load(value);
        }
        load(data) {
            var _a, _b, _c, _d, _e;
            if (!data) {
                return;
            }
            if (data.preset !== undefined) {
                if (data.preset instanceof Array) {
                    for (const preset of data.preset) {
                        this.importPreset(preset);
                    }
                }
                else {
                    this.importPreset(data.preset);
                }
            }
            if (data.autoPlay !== undefined) {
                this.autoPlay = data.autoPlay;
            }
            const detectRetina = (_a = data.detectRetina) !== null && _a !== void 0 ? _a : data.retina_detect;
            if (detectRetina !== undefined) {
                this.detectRetina = detectRetina;
            }
            if (data.duration !== undefined) {
                this.duration = data.duration;
            }
            const fpsLimit = (_b = data.fpsLimit) !== null && _b !== void 0 ? _b : data.fps_limit;
            if (fpsLimit !== undefined) {
                this.fpsLimit = fpsLimit;
            }
            if (data.pauseOnBlur !== undefined) {
                this.pauseOnBlur = data.pauseOnBlur;
            }
            if (data.pauseOnOutsideViewport !== undefined) {
                this.pauseOnOutsideViewport = data.pauseOnOutsideViewport;
            }
            if (data.zLayers !== undefined) {
                this.zLayers = data.zLayers;
            }
            this.background.load(data.background);
            const fullScreen = (_c = data.fullScreen) !== null && _c !== void 0 ? _c : data.backgroundMode;
            if (typeof fullScreen === "boolean") {
                this.fullScreen.enable = fullScreen;
            }
            else {
                this.fullScreen.load(fullScreen);
            }
            this.backgroundMask.load(data.backgroundMask);
            this.interactivity.load(data.interactivity);
            if (data.manualParticles !== undefined) {
                this.manualParticles = data.manualParticles.map((t) => {
                    const tmp = new ManualParticle();
                    tmp.load(t);
                    return tmp;
                });
            }
            this.motion.load(data.motion);
            this.particles.load(data.particles);
            this.style = deepExtend(this.style, data.style);
            __classPrivateFieldGet$c(this, _Options_engine, "f").plugins.loadOptions(this, data);
            if (data.responsive !== undefined) {
                for (const responsive of data.responsive) {
                    const optResponsive = new Responsive();
                    optResponsive.load(responsive);
                    this.responsive.push(optResponsive);
                }
            }
            this.responsive.sort((a, b) => a.maxWidth - b.maxWidth);
            if (data.themes !== undefined) {
                for (const theme of data.themes) {
                    const optTheme = new Theme();
                    optTheme.load(theme);
                    this.themes.push(optTheme);
                }
            }
            this.defaultDarkTheme = (_d = __classPrivateFieldGet$c(this, _Options_instances, "m", _Options_findDefaultTheme).call(this, "dark")) === null || _d === void 0 ? void 0 : _d.name;
            this.defaultLightTheme = (_e = __classPrivateFieldGet$c(this, _Options_instances, "m", _Options_findDefaultTheme).call(this, "light")) === null || _e === void 0 ? void 0 : _e.name;
        }
        setTheme(name) {
            if (name) {
                const chosenTheme = this.themes.find((theme) => theme.name === name);
                if (chosenTheme) {
                    this.load(chosenTheme.options);
                }
            }
            else {
                const mediaMatch = typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)"), clientDarkMode = mediaMatch && mediaMatch.matches, defaultTheme = __classPrivateFieldGet$c(this, _Options_instances, "m", _Options_findDefaultTheme).call(this, clientDarkMode ? "dark" : "light");
                if (defaultTheme) {
                    this.load(defaultTheme.options);
                }
            }
        }
        setResponsive(width, pxRatio, defaultOptions) {
            this.load(defaultOptions);
            const responsiveOptions = this.responsive.find((t) => t.mode === "screen" && screen
                ? t.maxWidth * pxRatio > screen.availWidth
                : t.maxWidth * pxRatio > width);
            this.load(responsiveOptions === null || responsiveOptions === void 0 ? void 0 : responsiveOptions.options);
            return responsiveOptions === null || responsiveOptions === void 0 ? void 0 : responsiveOptions.maxWidth;
        }
        importPreset(preset) {
            this.load(__classPrivateFieldGet$c(this, _Options_engine, "f").plugins.getPreset(preset));
        }
    }
    _Options_engine = new WeakMap(), _Options_instances = new WeakSet(), _Options_findDefaultTheme = function _Options_findDefaultTheme(mode) {
        var _a;
        return ((_a = this.themes.find((theme) => theme.default.value && theme.default.mode === mode)) !== null && _a !== void 0 ? _a : this.themes.find((theme) => theme.default.value && theme.default.mode === "any"));
    };

    class ColorAnimation {
        constructor() {
            this.count = 0;
            this.enable = false;
            this.offset = 0;
            this.speed = 1;
            this.sync = true;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.count !== undefined) {
                this.count = setRangeValue(data.count);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.offset !== undefined) {
                this.offset = setRangeValue(data.offset);
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class HslAnimation {
        constructor() {
            this.h = new ColorAnimation();
            this.s = new ColorAnimation();
            this.l = new ColorAnimation();
        }
        load(data) {
            if (!data) {
                return;
            }
            this.h.load(data.h);
            this.s.load(data.s);
            this.l.load(data.l);
        }
    }

    class AnimatableColor extends OptionsColor {
        constructor() {
            super();
            this.animation = new HslAnimation();
        }
        static create(source, data) {
            const color = new AnimatableColor();
            color.load(source);
            if (data !== undefined) {
                if (typeof data === "string" || data instanceof Array) {
                    color.load({ value: data });
                }
                else {
                    color.load(data);
                }
            }
            return color;
        }
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            const colorAnimation = data.animation;
            if (colorAnimation !== undefined) {
                if (colorAnimation.enable !== undefined) {
                    this.animation.h.load(colorAnimation);
                }
                else {
                    this.animation.load(data.animation);
                }
            }
        }
    }

    class AnimatableGradient {
        constructor() {
            this.angle = new GradientAngle();
            this.colors = [];
            this.type = "random";
        }
        load(data) {
            if (!data) {
                return;
            }
            this.angle.load(data.angle);
            if (data.colors !== undefined) {
                this.colors = data.colors.map((s) => {
                    const tmp = new AnimatableGradientColor();
                    tmp.load(s);
                    return tmp;
                });
            }
            if (data.type !== undefined) {
                this.type = data.type;
            }
        }
    }
    class GradientAngle {
        constructor() {
            this.value = 0;
            this.animation = new GradientAngleAnimation();
            this.direction = "clockwise";
        }
        load(data) {
            if (!data) {
                return;
            }
            this.animation.load(data.animation);
            if (data.value !== undefined) {
                this.value = data.value;
            }
            if (data.direction !== undefined) {
                this.direction = data.direction;
            }
        }
    }
    class GradientColorOpacity {
        constructor() {
            this.value = 0;
            this.animation = new GradientColorOpacityAnimation();
        }
        load(data) {
            if (!data) {
                return;
            }
            this.animation.load(data.animation);
            if (data.value !== undefined) {
                this.value = setRangeValue(data.value);
            }
        }
    }
    class AnimatableGradientColor {
        constructor() {
            this.stop = 0;
            this.value = new AnimatableColor();
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.stop !== undefined) {
                this.stop = data.stop;
            }
            this.value = AnimatableColor.create(this.value, data.value);
            if (data.opacity !== undefined) {
                this.opacity = new GradientColorOpacity();
                if (typeof data.opacity === "number") {
                    this.opacity.value = data.opacity;
                }
                else {
                    this.opacity.load(data.opacity);
                }
            }
        }
    }
    class GradientAngleAnimation {
        constructor() {
            this.count = 0;
            this.enable = false;
            this.speed = 0;
            this.sync = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.count !== undefined) {
                this.count = setRangeValue(data.count);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }
    class GradientColorOpacityAnimation {
        constructor() {
            this.count = 0;
            this.enable = false;
            this.speed = 0;
            this.sync = false;
            this.startValue = "random";
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.count !== undefined) {
                this.count = setRangeValue(data.count);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
            if (data.startValue !== undefined) {
                this.startValue = data.startValue;
            }
        }
    }

    class CollisionsOverlap {
        constructor() {
            this.enable = true;
            this.retries = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.retries !== undefined) {
                this.retries = data.retries;
            }
        }
    }

    class Random {
        constructor() {
            this.enable = false;
            this.minimumValue = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.minimumValue !== undefined) {
                this.minimumValue = data.minimumValue;
            }
        }
    }

    class ValueWithRandom {
        constructor() {
            this.random = new Random();
            this.value = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (typeof data.random === "boolean") {
                this.random.enable = data.random;
            }
            else {
                this.random.load(data.random);
            }
            if (data.value !== undefined) {
                this.value = setRangeValue(data.value, this.random.enable ? this.random.minimumValue : undefined);
            }
        }
    }

    class ParticlesBounceFactor extends ValueWithRandom {
        constructor() {
            super();
            this.random.minimumValue = 0.1;
            this.value = 1;
        }
    }

    class ParticlesBounce {
        constructor() {
            this.horizontal = new ParticlesBounceFactor();
            this.vertical = new ParticlesBounceFactor();
        }
        load(data) {
            if (!data) {
                return;
            }
            this.horizontal.load(data.horizontal);
            this.vertical.load(data.vertical);
        }
    }

    class Collisions {
        constructor() {
            this.bounce = new ParticlesBounce();
            this.enable = false;
            this.mode = "bounce";
            this.overlap = new CollisionsOverlap();
        }
        load(data) {
            if (!data) {
                return;
            }
            this.bounce.load(data.bounce);
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
            this.overlap.load(data.overlap);
        }
    }

    class SplitFactor extends ValueWithRandom {
        constructor() {
            super();
            this.value = 3;
        }
    }

    class SplitRate extends ValueWithRandom {
        constructor() {
            super();
            this.value = { min: 4, max: 9 };
        }
    }

    class Split {
        constructor() {
            this.count = 1;
            this.factor = new SplitFactor();
            this.rate = new SplitRate();
            this.sizeOffset = true;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.count !== undefined) {
                this.count = data.count;
            }
            this.factor.load(data.factor);
            this.rate.load(data.rate);
            if (data.particles !== undefined) {
                this.particles = deepExtend({}, data.particles);
            }
            if (data.sizeOffset !== undefined) {
                this.sizeOffset = data.sizeOffset;
            }
        }
    }

    class Destroy {
        constructor() {
            this.mode = "none";
            this.split = new Split();
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
            this.split.load(data.split);
        }
    }

    class LifeDelay extends ValueWithRandom {
        constructor() {
            super();
            this.sync = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            super.load(data);
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class LifeDuration extends ValueWithRandom {
        constructor() {
            super();
            this.random.minimumValue = 0.0001;
            this.sync = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            super.load(data);
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class Life {
        constructor() {
            this.count = 0;
            this.delay = new LifeDelay();
            this.duration = new LifeDuration();
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.count !== undefined) {
                this.count = data.count;
            }
            this.delay.load(data.delay);
            this.duration.load(data.duration);
        }
    }

    class LinksShadow {
        constructor() {
            this.blur = 5;
            this.color = new OptionsColor();
            this.color.value = "#000";
            this.enable = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.blur !== undefined) {
                this.blur = data.blur;
            }
            this.color = OptionsColor.create(this.color, data.color);
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
        }
    }

    class LinksTriangle {
        constructor() {
            this.enable = false;
            this.frequency = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.color !== undefined) {
                this.color = OptionsColor.create(this.color, data.color);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.frequency !== undefined) {
                this.frequency = data.frequency;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
        }
    }

    class Links {
        constructor() {
            this.blink = false;
            this.color = new OptionsColor();
            this.color.value = "#fff";
            this.consent = false;
            this.distance = 100;
            this.enable = false;
            this.frequency = 1;
            this.opacity = 1;
            this.shadow = new LinksShadow();
            this.triangles = new LinksTriangle();
            this.width = 1;
            this.warp = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.id !== undefined) {
                this.id = data.id;
            }
            if (data.blink !== undefined) {
                this.blink = data.blink;
            }
            this.color = OptionsColor.create(this.color, data.color);
            if (data.consent !== undefined) {
                this.consent = data.consent;
            }
            if (data.distance !== undefined) {
                this.distance = data.distance;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.frequency !== undefined) {
                this.frequency = data.frequency;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
            this.shadow.load(data.shadow);
            this.triangles.load(data.triangles);
            if (data.width !== undefined) {
                this.width = data.width;
            }
            if (data.warp !== undefined) {
                this.warp = data.warp;
            }
        }
    }

    class MoveAngle {
        constructor() {
            this.offset = 0;
            this.value = 90;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.offset !== undefined) {
                this.offset = setRangeValue(data.offset);
            }
            if (data.value !== undefined) {
                this.value = setRangeValue(data.value);
            }
        }
    }

    class MoveAttract {
        constructor() {
            this.distance = 200;
            this.enable = false;
            this.rotate = {
                x: 3000,
                y: 3000,
            };
        }
        get rotateX() {
            return this.rotate.x;
        }
        set rotateX(value) {
            this.rotate.x = value;
        }
        get rotateY() {
            return this.rotate.y;
        }
        set rotateY(value) {
            this.rotate.y = value;
        }
        load(data) {
            var _a, _b, _c, _d;
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = setRangeValue(data.distance);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            const rotateX = (_b = (_a = data.rotate) === null || _a === void 0 ? void 0 : _a.x) !== null && _b !== void 0 ? _b : data.rotateX;
            if (rotateX !== undefined) {
                this.rotate.x = rotateX;
            }
            const rotateY = (_d = (_c = data.rotate) === null || _c === void 0 ? void 0 : _c.y) !== null && _d !== void 0 ? _d : data.rotateY;
            if (rotateY !== undefined) {
                this.rotate.y = rotateY;
            }
        }
    }

    class MoveGravity {
        constructor() {
            this.acceleration = 9.81;
            this.enable = false;
            this.inverse = false;
            this.maxSpeed = 50;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.acceleration !== undefined) {
                this.acceleration = setRangeValue(data.acceleration);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.inverse !== undefined) {
                this.inverse = data.inverse;
            }
            if (data.maxSpeed !== undefined) {
                this.maxSpeed = setRangeValue(data.maxSpeed);
            }
        }
    }

    class MovePathDelay extends ValueWithRandom {
        constructor() {
            super();
        }
    }

    class MovePath {
        constructor() {
            this.clamp = true;
            this.delay = new MovePathDelay();
            this.enable = false;
            this.options = {};
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.clamp !== undefined) {
                this.clamp = data.clamp;
            }
            this.delay.load(data.delay);
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            this.generator = data.generator;
            if (data.options) {
                this.options = deepExtend(this.options, data.options);
            }
        }
    }

    class MoveTrail {
        constructor() {
            this.enable = false;
            this.length = 10;
            this.fillColor = new OptionsColor();
            this.fillColor.value = "#000000";
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            this.fillColor = OptionsColor.create(this.fillColor, data.fillColor);
            if (data.length !== undefined) {
                this.length = data.length;
            }
        }
    }

    class OutModes {
        constructor() {
            this.default = "out";
        }
        load(data) {
            var _a, _b, _c, _d;
            if (!data) {
                return;
            }
            if (data.default !== undefined) {
                this.default = data.default;
            }
            this.bottom = (_a = data.bottom) !== null && _a !== void 0 ? _a : data.default;
            this.left = (_b = data.left) !== null && _b !== void 0 ? _b : data.default;
            this.right = (_c = data.right) !== null && _c !== void 0 ? _c : data.default;
            this.top = (_d = data.top) !== null && _d !== void 0 ? _d : data.default;
        }
    }

    class Spin {
        constructor() {
            this.acceleration = 0;
            this.enable = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.acceleration !== undefined) {
                this.acceleration = setRangeValue(data.acceleration);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            this.position = data.position ? deepExtend({}, data.position) : undefined;
        }
    }

    class Move {
        constructor() {
            this.angle = new MoveAngle();
            this.attract = new MoveAttract();
            this.center = {
                x: 50,
                y: 50,
                radius: 0,
            };
            this.decay = 0;
            this.distance = {};
            this.direction = "none";
            this.drift = 0;
            this.enable = false;
            this.gravity = new MoveGravity();
            this.path = new MovePath();
            this.outModes = new OutModes();
            this.random = false;
            this.size = false;
            this.speed = 2;
            this.spin = new Spin();
            this.straight = false;
            this.trail = new MoveTrail();
            this.vibrate = false;
            this.warp = false;
        }
        get collisions() {
            return false;
        }
        set collisions(value) {
        }
        get bounce() {
            return this.collisions;
        }
        set bounce(value) {
            this.collisions = value;
        }
        get out_mode() {
            return this.outMode;
        }
        set out_mode(value) {
            this.outMode = value;
        }
        get outMode() {
            return this.outModes.default;
        }
        set outMode(value) {
            this.outModes.default = value;
        }
        get noise() {
            return this.path;
        }
        set noise(value) {
            this.path = value;
        }
        load(data) {
            var _a, _b, _c;
            if (!data) {
                return;
            }
            if (data.angle !== undefined) {
                if (typeof data.angle === "number") {
                    this.angle.value = data.angle;
                }
                else {
                    this.angle.load(data.angle);
                }
            }
            this.attract.load(data.attract);
            this.center = deepExtend(this.center, data.center);
            if (data.decay !== undefined) {
                this.decay = data.decay;
            }
            if (data.direction !== undefined) {
                this.direction = data.direction;
            }
            if (data.distance !== undefined) {
                this.distance =
                    typeof data.distance === "number"
                        ? {
                            horizontal: data.distance,
                            vertical: data.distance,
                        }
                        : deepExtend({}, data.distance);
            }
            if (data.drift !== undefined) {
                this.drift = setRangeValue(data.drift);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            this.gravity.load(data.gravity);
            const outMode = (_a = data.outMode) !== null && _a !== void 0 ? _a : data.out_mode;
            if (data.outModes !== undefined || outMode !== undefined) {
                if (typeof data.outModes === "string" || (data.outModes === undefined && outMode !== undefined)) {
                    this.outModes.load({
                        default: (_b = data.outModes) !== null && _b !== void 0 ? _b : outMode,
                    });
                }
                else {
                    this.outModes.load(data.outModes);
                }
            }
            this.path.load((_c = data.path) !== null && _c !== void 0 ? _c : data.noise);
            if (data.random !== undefined) {
                this.random = data.random;
            }
            if (data.size !== undefined) {
                this.size = data.size;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
            this.spin.load(data.spin);
            if (data.straight !== undefined) {
                this.straight = data.straight;
            }
            this.trail.load(data.trail);
            if (data.vibrate !== undefined) {
                this.vibrate = data.vibrate;
            }
            if (data.warp !== undefined) {
                this.warp = data.warp;
            }
        }
    }

    class AnimationOptions {
        constructor() {
            this.count = 0;
            this.enable = false;
            this.speed = 1;
            this.sync = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.count !== undefined) {
                this.count = setRangeValue(data.count);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class OpacityAnimation extends AnimationOptions {
        constructor() {
            super();
            this.destroy = "none";
            this.enable = false;
            this.speed = 2;
            this.startValue = "random";
            this.sync = false;
        }
        get opacity_min() {
            return this.minimumValue;
        }
        set opacity_min(value) {
            this.minimumValue = value;
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            super.load(data);
            if (data.destroy !== undefined) {
                this.destroy = data.destroy;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            this.minimumValue = (_a = data.minimumValue) !== null && _a !== void 0 ? _a : data.opacity_min;
            if (data.speed !== undefined) {
                this.speed = data.speed;
            }
            if (data.startValue !== undefined) {
                this.startValue = data.startValue;
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class Opacity extends ValueWithRandom {
        constructor() {
            super();
            this.animation = new OpacityAnimation();
            this.random.minimumValue = 0.1;
            this.value = 1;
        }
        get anim() {
            return this.animation;
        }
        set anim(value) {
            this.animation = value;
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            super.load(data);
            const animation = (_a = data.animation) !== null && _a !== void 0 ? _a : data.anim;
            if (animation !== undefined) {
                this.animation.load(animation);
                this.value = setRangeValue(this.value, this.animation.enable ? this.animation.minimumValue : undefined);
            }
        }
    }

    class OrbitRotation extends ValueWithRandom {
        constructor() {
            super();
            this.value = 45;
            this.random.enable = false;
            this.random.minimumValue = 0;
        }
        load(data) {
            if (data === undefined) {
                return;
            }
            super.load(data);
        }
    }

    class Orbit {
        constructor() {
            this.animation = new AnimationOptions();
            this.enable = false;
            this.opacity = 1;
            this.rotation = new OrbitRotation();
            this.width = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            this.animation.load(data.animation);
            this.rotation.load(data.rotation);
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.opacity !== undefined) {
                this.opacity = setRangeValue(data.opacity);
            }
            if (data.width !== undefined) {
                this.width = setRangeValue(data.width);
            }
            if (data.radius !== undefined) {
                this.radius = setRangeValue(data.radius);
            }
            if (data.color !== undefined) {
                this.color = OptionsColor.create(this.color, data.color);
            }
        }
    }

    class ParticlesDensity {
        constructor() {
            this.enable = false;
            this.area = 800;
            this.factor = 1000;
        }
        get value_area() {
            return this.area;
        }
        set value_area(value) {
            this.area = value;
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            const area = (_a = data.area) !== null && _a !== void 0 ? _a : data.value_area;
            if (area !== undefined) {
                this.area = area;
            }
            if (data.factor !== undefined) {
                this.factor = data.factor;
            }
        }
    }

    class ParticlesNumber {
        constructor() {
            this.density = new ParticlesDensity();
            this.limit = 0;
            this.value = 100;
        }
        get max() {
            return this.limit;
        }
        set max(value) {
            this.limit = value;
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            this.density.load(data.density);
            const limit = (_a = data.limit) !== null && _a !== void 0 ? _a : data.max;
            if (limit !== undefined) {
                this.limit = limit;
            }
            if (data.value !== undefined) {
                this.value = data.value;
            }
        }
    }

    class ParticlesRepulse extends ValueWithRandom {
        constructor() {
            super();
            this.enabled = false;
            this.distance = 1;
            this.duration = 1;
            this.factor = 1;
            this.speed = 1;
        }
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            if (data.enabled !== undefined) {
                this.enabled = data.enabled;
            }
            if (data.distance !== undefined) {
                this.distance = setRangeValue(data.distance);
            }
            if (data.duration !== undefined) {
                this.duration = setRangeValue(data.duration);
            }
            if (data.factor !== undefined) {
                this.factor = setRangeValue(data.factor);
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
        }
    }

    class RollLight {
        constructor() {
            this.enable = false;
            this.value = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.value !== undefined) {
                this.value = setRangeValue(data.value);
            }
        }
    }

    class Roll {
        constructor() {
            this.darken = new RollLight();
            this.enable = false;
            this.enlighten = new RollLight();
            this.mode = "vertical";
            this.speed = 25;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.backColor !== undefined) {
                this.backColor = OptionsColor.create(this.backColor, data.backColor);
            }
            this.darken.load(data.darken);
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            this.enlighten.load(data.enlighten);
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
        }
    }

    class RotateAnimation {
        constructor() {
            this.enable = false;
            this.speed = 0;
            this.sync = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class Rotate extends ValueWithRandom {
        constructor() {
            super();
            this.animation = new RotateAnimation();
            this.direction = "clockwise";
            this.path = false;
            this.value = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            super.load(data);
            if (data.direction !== undefined) {
                this.direction = data.direction;
            }
            this.animation.load(data.animation);
            if (data.path !== undefined) {
                this.path = data.path;
            }
        }
    }

    class Shadow {
        constructor() {
            this.blur = 0;
            this.color = new OptionsColor();
            this.enable = false;
            this.offset = {
                x: 0,
                y: 0,
            };
            this.color.value = "#000";
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.blur !== undefined) {
                this.blur = data.blur;
            }
            this.color = OptionsColor.create(this.color, data.color);
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.offset === undefined) {
                return;
            }
            if (data.offset.x !== undefined) {
                this.offset.x = data.offset.x;
            }
            if (data.offset.y !== undefined) {
                this.offset.y = data.offset.y;
            }
        }
    }

    class Shape {
        constructor() {
            this.options = {};
            this.type = "circle";
        }
        get image() {
            var _a;
            return ((_a = this.options["image"]) !== null && _a !== void 0 ? _a : this.options["images"]);
        }
        set image(value) {
            this.options["image"] = value;
            this.options["images"] = value;
        }
        get custom() {
            return this.options;
        }
        set custom(value) {
            this.options = value;
        }
        get images() {
            return this.image;
        }
        set images(value) {
            this.image = value;
        }
        get stroke() {
            return [];
        }
        set stroke(_value) {
        }
        get character() {
            var _a;
            return ((_a = this.options["character"]) !== null && _a !== void 0 ? _a : this.options["char"]);
        }
        set character(value) {
            this.options["character"] = value;
            this.options["char"] = value;
        }
        get polygon() {
            var _a;
            return ((_a = this.options["polygon"]) !== null && _a !== void 0 ? _a : this.options["star"]);
        }
        set polygon(value) {
            this.options["polygon"] = value;
            this.options["star"] = value;
        }
        load(data) {
            var _a, _b, _c;
            if (!data) {
                return;
            }
            const options = (_a = data.options) !== null && _a !== void 0 ? _a : data.custom;
            if (options !== undefined) {
                for (const shape in options) {
                    const item = options[shape];
                    if (item) {
                        this.options[shape] = deepExtend((_b = this.options[shape]) !== null && _b !== void 0 ? _b : {}, item);
                    }
                }
            }
            this.loadShape(data.character, "character", "char", true);
            this.loadShape(data.polygon, "polygon", "star", false);
            this.loadShape((_c = data.image) !== null && _c !== void 0 ? _c : data.images, "image", "images", true);
            if (data.type !== undefined) {
                this.type = data.type;
            }
        }
        loadShape(item, mainKey, altKey, altOverride) {
            var _a, _b, _c, _d;
            if (item === undefined) {
                return;
            }
            if (item instanceof Array) {
                if (!(this.options[mainKey] instanceof Array)) {
                    this.options[mainKey] = [];
                    if (!this.options[altKey] || altOverride) {
                        this.options[altKey] = [];
                    }
                }
                this.options[mainKey] = deepExtend((_a = this.options[mainKey]) !== null && _a !== void 0 ? _a : [], item);
                if (!this.options[altKey] || altOverride) {
                    this.options[altKey] = deepExtend((_b = this.options[altKey]) !== null && _b !== void 0 ? _b : [], item);
                }
            }
            else {
                if (this.options[mainKey] instanceof Array) {
                    this.options[mainKey] = {};
                    if (!this.options[altKey] || altOverride) {
                        this.options[altKey] = {};
                    }
                }
                this.options[mainKey] = deepExtend((_c = this.options[mainKey]) !== null && _c !== void 0 ? _c : {}, item);
                if (!this.options[altKey] || altOverride) {
                    this.options[altKey] = deepExtend((_d = this.options[altKey]) !== null && _d !== void 0 ? _d : {}, item);
                }
            }
        }
    }

    class SizeAnimation extends AnimationOptions {
        constructor() {
            super();
            this.destroy = "none";
            this.enable = false;
            this.speed = 5;
            this.startValue = "random";
            this.sync = false;
        }
        get size_min() {
            return this.minimumValue;
        }
        set size_min(value) {
            this.minimumValue = value;
        }
        load(data) {
            var _a;
            super.load(data);
            if (!data) {
                return;
            }
            if (data.destroy !== undefined) {
                this.destroy = data.destroy;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            this.minimumValue = (_a = data.minimumValue) !== null && _a !== void 0 ? _a : data.size_min;
            if (data.speed !== undefined) {
                this.speed = data.speed;
            }
            if (data.startValue !== undefined) {
                this.startValue = data.startValue;
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class Size extends ValueWithRandom {
        constructor() {
            super();
            this.animation = new SizeAnimation();
            this.random.minimumValue = 1;
            this.value = 3;
        }
        get anim() {
            return this.animation;
        }
        set anim(value) {
            this.animation = value;
        }
        load(data) {
            var _a;
            super.load(data);
            if (!data) {
                return;
            }
            const animation = (_a = data.animation) !== null && _a !== void 0 ? _a : data.anim;
            if (animation !== undefined) {
                this.animation.load(animation);
                this.value = setRangeValue(this.value, this.animation.enable ? this.animation.minimumValue : undefined);
            }
        }
    }

    class Stroke {
        constructor() {
            this.width = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.color !== undefined) {
                this.color = AnimatableColor.create(this.color, data.color);
            }
            if (data.width !== undefined) {
                this.width = data.width;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
        }
    }

    class TiltAnimation {
        constructor() {
            this.enable = false;
            this.speed = 0;
            this.sync = false;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
            if (data.sync !== undefined) {
                this.sync = data.sync;
            }
        }
    }

    class Tilt extends ValueWithRandom {
        constructor() {
            super();
            this.animation = new TiltAnimation();
            this.direction = "clockwise";
            this.enable = false;
            this.value = 0;
        }
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            this.animation.load(data.animation);
            if (data.direction !== undefined) {
                this.direction = data.direction;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
        }
    }

    class TwinkleValues {
        constructor() {
            this.enable = false;
            this.frequency = 0.05;
            this.opacity = 1;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.color !== undefined) {
                this.color = OptionsColor.create(this.color, data.color);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.frequency !== undefined) {
                this.frequency = data.frequency;
            }
            if (data.opacity !== undefined) {
                this.opacity = setRangeValue(data.opacity);
            }
        }
    }

    class Twinkle {
        constructor() {
            this.lines = new TwinkleValues();
            this.particles = new TwinkleValues();
        }
        load(data) {
            if (!data) {
                return;
            }
            this.lines.load(data.lines);
            this.particles.load(data.particles);
        }
    }

    class Wobble {
        constructor() {
            this.distance = 5;
            this.enable = false;
            this.speed = 50;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.distance !== undefined) {
                this.distance = setRangeValue(data.distance);
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            if (data.speed !== undefined) {
                this.speed = setRangeValue(data.speed);
            }
        }
    }

    class ZIndex extends ValueWithRandom {
        constructor() {
            super();
            this.opacityRate = 1;
            this.sizeRate = 1;
            this.velocityRate = 1;
        }
        load(data) {
            super.load(data);
            if (!data) {
                return;
            }
            if (data.opacityRate !== undefined) {
                this.opacityRate = data.opacityRate;
            }
            if (data.sizeRate !== undefined) {
                this.sizeRate = data.sizeRate;
            }
            if (data.velocityRate !== undefined) {
                this.velocityRate = data.velocityRate;
            }
        }
    }

    class ParticlesOptions {
        constructor() {
            this.bounce = new ParticlesBounce();
            this.collisions = new Collisions();
            this.color = new AnimatableColor();
            this.color.value = "#fff";
            this.destroy = new Destroy();
            this.gradient = [];
            this.groups = {};
            this.life = new Life();
            this.links = new Links();
            this.move = new Move();
            this.number = new ParticlesNumber();
            this.opacity = new Opacity();
            this.orbit = new Orbit();
            this.reduceDuplicates = false;
            this.repulse = new ParticlesRepulse();
            this.roll = new Roll();
            this.rotate = new Rotate();
            this.shadow = new Shadow();
            this.shape = new Shape();
            this.size = new Size();
            this.stroke = new Stroke();
            this.tilt = new Tilt();
            this.twinkle = new Twinkle();
            this.wobble = new Wobble();
            this.zIndex = new ZIndex();
        }
        get line_linked() {
            return this.links;
        }
        set line_linked(value) {
            this.links = value;
        }
        get lineLinked() {
            return this.links;
        }
        set lineLinked(value) {
            this.links = value;
        }
        load(data) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            if (!data) {
                return;
            }
            this.bounce.load(data.bounce);
            this.color.load(AnimatableColor.create(this.color, data.color));
            this.destroy.load(data.destroy);
            this.life.load(data.life);
            const links = (_b = (_a = data.links) !== null && _a !== void 0 ? _a : data.lineLinked) !== null && _b !== void 0 ? _b : data.line_linked;
            if (links !== undefined) {
                this.links.load(links);
            }
            if (data.groups !== undefined) {
                for (const group in data.groups) {
                    const item = data.groups[group];
                    if (item !== undefined) {
                        this.groups[group] = deepExtend((_c = this.groups[group]) !== null && _c !== void 0 ? _c : {}, item);
                    }
                }
            }
            this.move.load(data.move);
            this.number.load(data.number);
            this.opacity.load(data.opacity);
            this.orbit.load(data.orbit);
            if (data.reduceDuplicates !== undefined) {
                this.reduceDuplicates = data.reduceDuplicates;
            }
            this.repulse.load(data.repulse);
            this.roll.load(data.roll);
            this.rotate.load(data.rotate);
            this.shape.load(data.shape);
            this.size.load(data.size);
            this.shadow.load(data.shadow);
            this.tilt.load(data.tilt);
            this.twinkle.load(data.twinkle);
            this.wobble.load(data.wobble);
            this.zIndex.load(data.zIndex);
            const collisions = (_e = (_d = data.move) === null || _d === void 0 ? void 0 : _d.collisions) !== null && _e !== void 0 ? _e : (_f = data.move) === null || _f === void 0 ? void 0 : _f.bounce;
            if (collisions !== undefined) {
                this.collisions.enable = collisions;
            }
            this.collisions.load(data.collisions);
            const strokeToLoad = (_g = data.stroke) !== null && _g !== void 0 ? _g : (_h = data.shape) === null || _h === void 0 ? void 0 : _h.stroke;
            if (strokeToLoad) {
                if (strokeToLoad instanceof Array) {
                    this.stroke = strokeToLoad.map((s) => {
                        const tmp = new Stroke();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    if (this.stroke instanceof Array) {
                        this.stroke = new Stroke();
                    }
                    this.stroke.load(strokeToLoad);
                }
            }
            const gradientToLoad = data.gradient;
            if (gradientToLoad) {
                if (gradientToLoad instanceof Array) {
                    this.gradient = gradientToLoad.map((s) => {
                        const tmp = new AnimatableGradient();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    if (this.gradient instanceof Array) {
                        this.gradient = new AnimatableGradient();
                    }
                    this.gradient.load(gradientToLoad);
                }
            }
        }
    }

    function rectSideBounce(pSide, pOtherSide, rectSide, rectOtherSide, velocity, factor) {
        const res = { bounced: false };
        if (pOtherSide.min < rectOtherSide.min ||
            pOtherSide.min > rectOtherSide.max ||
            pOtherSide.max < rectOtherSide.min ||
            pOtherSide.max > rectOtherSide.max) {
            return res;
        }
        if ((pSide.max >= rectSide.min && pSide.max <= (rectSide.max + rectSide.min) / 2 && velocity > 0) ||
            (pSide.min <= rectSide.max && pSide.min > (rectSide.max + rectSide.min) / 2 && velocity < 0)) {
            res.velocity = velocity * -factor;
            res.bounced = true;
        }
        return res;
    }
    function checkSelector(element, selectors) {
        if (!(selectors instanceof Array)) {
            return element.matches(selectors);
        }
        for (const selector of selectors) {
            if (element.matches(selector)) {
                return true;
            }
        }
        return false;
    }
    function isSsr() {
        return typeof window === "undefined" || !window || typeof window.document === "undefined" || !window.document;
    }
    function animate() {
        return isSsr()
            ? (callback) => setTimeout(callback)
            : (callback) => (window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                window.setTimeout)(callback);
    }
    function cancelAnimation() {
        return isSsr()
            ? (handle) => clearTimeout(handle)
            : (handle) => (window.cancelAnimationFrame ||
                window.webkitCancelRequestAnimationFrame ||
                window.mozCancelRequestAnimationFrame ||
                window.oCancelRequestAnimationFrame ||
                window.msCancelRequestAnimationFrame ||
                window.clearTimeout)(handle);
    }
    function isInArray(value, array) {
        return value === array || (array instanceof Array && array.indexOf(value) > -1);
    }
    async function loadFont(font, weight) {
        try {
            await document.fonts.load(`${weight !== null && weight !== void 0 ? weight : "400"} 36px '${font !== null && font !== void 0 ? font : "Verdana"}'`);
        }
        catch (_a) {
        }
    }
    function arrayRandomIndex(array) {
        return Math.floor(Math.random() * array.length);
    }
    function itemFromArray(array, index, useIndex = true) {
        const fixedIndex = index !== undefined && useIndex ? index % array.length : arrayRandomIndex(array);
        return array[fixedIndex];
    }
    function isPointInside(point, size, offset, radius, direction) {
        return areBoundsInside(calculateBounds(point, radius !== null && radius !== void 0 ? radius : 0), size, offset, direction);
    }
    function areBoundsInside(bounds, size, offset, direction) {
        let inside = true;
        if (!direction || direction === "bottom") {
            inside = bounds.top < size.height + offset.x;
        }
        if (inside && (!direction || direction === "left")) {
            inside = bounds.right > offset.x;
        }
        if (inside && (!direction || direction === "right")) {
            inside = bounds.left < size.width + offset.y;
        }
        if (inside && (!direction || direction === "top")) {
            inside = bounds.bottom > offset.y;
        }
        return inside;
    }
    function calculateBounds(point, radius) {
        return {
            bottom: point.y + radius,
            left: point.x - radius,
            right: point.x + radius,
            top: point.y - radius,
        };
    }
    function deepExtend(destination, ...sources) {
        for (const source of sources) {
            if (source === undefined || source === null) {
                continue;
            }
            if (typeof source !== "object") {
                destination = source;
                continue;
            }
            const sourceIsArray = Array.isArray(source);
            if (sourceIsArray && (typeof destination !== "object" || !destination || !Array.isArray(destination))) {
                destination = [];
            }
            else if (!sourceIsArray && (typeof destination !== "object" || !destination || Array.isArray(destination))) {
                destination = {};
            }
            for (const key in source) {
                if (key === "__proto__") {
                    continue;
                }
                const sourceDict = source, value = sourceDict[key], isObject = typeof value === "object", destDict = destination;
                destDict[key] =
                    isObject && Array.isArray(value)
                        ? value.map((v) => deepExtend(destDict[key], v))
                        : deepExtend(destDict[key], value);
            }
        }
        return destination;
    }
    function isDivModeEnabled(mode, divs) {
        return divs instanceof Array ? !!divs.find((t) => t.enable && isInArray(mode, t.mode)) : isInArray(mode, divs.mode);
    }
    function divModeExecute(mode, divs, callback) {
        if (divs instanceof Array) {
            for (const div of divs) {
                const divMode = div.mode, divEnabled = div.enable;
                if (divEnabled && isInArray(mode, divMode)) {
                    singleDivModeExecute(div, callback);
                }
            }
        }
        else {
            const divMode = divs.mode, divEnabled = divs.enable;
            if (divEnabled && isInArray(mode, divMode)) {
                singleDivModeExecute(divs, callback);
            }
        }
    }
    function singleDivModeExecute(div, callback) {
        const selectors = div.selectors;
        if (selectors instanceof Array) {
            for (const selector of selectors) {
                callback(selector, div);
            }
        }
        else {
            callback(selectors, div);
        }
    }
    function divMode(divs, element) {
        if (!element || !divs) {
            return;
        }
        if (divs instanceof Array) {
            return divs.find((d) => checkSelector(element, d.selectors));
        }
        else if (checkSelector(element, divs.selectors)) {
            return divs;
        }
    }
    function circleBounceDataFromParticle(p) {
        return {
            position: p.getPosition(),
            radius: p.getRadius(),
            mass: p.getMass(),
            velocity: p.velocity,
            factor: Vector.create(getValue(p.options.bounce.horizontal), getValue(p.options.bounce.vertical)),
        };
    }
    function circleBounce(p1, p2) {
        const { x: xVelocityDiff, y: yVelocityDiff } = p1.velocity.sub(p2.velocity), [pos1, pos2] = [p1.position, p2.position], { dx: xDist, dy: yDist } = getDistances(pos2, pos1);
        if (xVelocityDiff * xDist + yVelocityDiff * yDist < 0) {
            return;
        }
        const angle = -Math.atan2(yDist, xDist), m1 = p1.mass, m2 = p2.mass, u1 = p1.velocity.rotate(angle), u2 = p2.velocity.rotate(angle), v1 = collisionVelocity(u1, u2, m1, m2), v2 = collisionVelocity(u2, u1, m1, m2), vFinal1 = v1.rotate(-angle), vFinal2 = v2.rotate(-angle);
        p1.velocity.x = vFinal1.x * p1.factor.x;
        p1.velocity.y = vFinal1.y * p1.factor.y;
        p2.velocity.x = vFinal2.x * p2.factor.x;
        p2.velocity.y = vFinal2.y * p2.factor.y;
    }
    function rectBounce(particle, divBounds) {
        const pPos = particle.getPosition(), size = particle.getRadius(), bounds = calculateBounds(pPos, size);
        const resH = rectSideBounce({
            min: bounds.left,
            max: bounds.right,
        }, {
            min: bounds.top,
            max: bounds.bottom,
        }, {
            min: divBounds.left,
            max: divBounds.right,
        }, {
            min: divBounds.top,
            max: divBounds.bottom,
        }, particle.velocity.x, getValue(particle.options.bounce.horizontal));
        if (resH.bounced) {
            if (resH.velocity !== undefined) {
                particle.velocity.x = resH.velocity;
            }
            if (resH.position !== undefined) {
                particle.position.x = resH.position;
            }
        }
        const resV = rectSideBounce({
            min: bounds.top,
            max: bounds.bottom,
        }, {
            min: bounds.left,
            max: bounds.right,
        }, {
            min: divBounds.top,
            max: divBounds.bottom,
        }, {
            min: divBounds.left,
            max: divBounds.right,
        }, particle.velocity.y, getValue(particle.options.bounce.vertical));
        if (resV.bounced) {
            if (resV.velocity !== undefined) {
                particle.velocity.y = resV.velocity;
            }
            if (resV.position !== undefined) {
                particle.position.y = resV.position;
            }
        }
    }
    function loadOptions(options, ...sourceOptionsArr) {
        for (const sourceOptions of sourceOptionsArr) {
            options.load(sourceOptions);
        }
    }
    function loadContainerOptions(engine, ...sourceOptionsArr) {
        const options = new Options(engine);
        loadOptions(options, ...sourceOptionsArr);
        return options;
    }
    function loadParticlesOptions(...sourceOptionsArr) {
        const options = new ParticlesOptions();
        loadOptions(options, ...sourceOptionsArr);
        return options;
    }

    const generatedAttribute = "generated";
    const randomColorValue = "random";
    const midColorValue = "mid";
    const touchEndEvent = "touchend";
    const mouseDownEvent = "mousedown";
    const mouseUpEvent = "mouseup";
    const mouseMoveEvent = "mousemove";
    const touchStartEvent = "touchstart";
    const touchMoveEvent = "touchmove";
    const mouseLeaveEvent = "mouseleave";
    const mouseOutEvent = "mouseout";
    const touchCancelEvent = "touchcancel";
    const resizeEvent = "resize";
    const visibilityChangeEvent = "visibilitychange";
    const noPolygonDataLoaded = "No polygon data loaded.";
    const noPolygonFound = "No polygon found, you need to specify SVG url in config.";

    function hue2rgb(p, q, t) {
        let tCalc = t;
        if (tCalc < 0) {
            tCalc += 1;
        }
        if (tCalc > 1) {
            tCalc -= 1;
        }
        if (tCalc < 1 / 6) {
            return p + (q - p) * 6 * tCalc;
        }
        if (tCalc < 1 / 2) {
            return q;
        }
        if (tCalc < 2 / 3) {
            return p + (q - p) * (2 / 3 - tCalc) * 6;
        }
        return p;
    }
    function stringToRgba(input) {
        if (input.startsWith("rgb")) {
            const regex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([\d.]+)\s*)?\)/i;
            const result = regex.exec(input);
            return result
                ? {
                    a: result.length > 4 ? parseFloat(result[5]) : 1,
                    b: parseInt(result[3], 10),
                    g: parseInt(result[2], 10),
                    r: parseInt(result[1], 10),
                }
                : undefined;
        }
        else if (input.startsWith("hsl")) {
            const regex = /hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(,\s*([\d.]+)\s*)?\)/i;
            const result = regex.exec(input);
            return result
                ? hslaToRgba({
                    a: result.length > 4 ? parseFloat(result[5]) : 1,
                    h: parseInt(result[1], 10),
                    l: parseInt(result[3], 10),
                    s: parseInt(result[2], 10),
                })
                : undefined;
        }
        else if (input.startsWith("hsv")) {
            const regex = /hsva?\(\s*(\d+)°\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(,\s*([\d.]+)\s*)?\)/i;
            const result = regex.exec(input);
            return result
                ? hsvaToRgba({
                    a: result.length > 4 ? parseFloat(result[5]) : 1,
                    h: parseInt(result[1], 10),
                    s: parseInt(result[2], 10),
                    v: parseInt(result[3], 10),
                })
                : undefined;
        }
        else {
            const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])([a-f\d])?$/i;
            const hexFixed = input.replace(shorthandRegex, (_m, r, g, b, a) => {
                return r + r + g + g + b + b + (a !== undefined ? a + a : "");
            });
            const regex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i;
            const result = regex.exec(hexFixed);
            return result
                ? {
                    a: result[4] !== undefined ? parseInt(result[4], 16) / 0xff : 1,
                    b: parseInt(result[3], 16),
                    g: parseInt(result[2], 16),
                    r: parseInt(result[1], 16),
                }
                : undefined;
        }
    }
    function colorToRgb(input, index, useIndex = true) {
        var _a, _b, _c;
        if (input === undefined) {
            return;
        }
        const color = typeof input === "string" ? { value: input } : input;
        let res;
        if (typeof color.value === "string") {
            res = color.value === randomColorValue ? getRandomRgbColor() : stringToRgb(color.value);
        }
        else {
            if (color.value instanceof Array) {
                const colorSelected = itemFromArray(color.value, index, useIndex);
                res = colorToRgb({ value: colorSelected });
            }
            else {
                const colorValue = color.value, rgbColor = (_a = colorValue.rgb) !== null && _a !== void 0 ? _a : color.value;
                if (rgbColor.r !== undefined) {
                    res = rgbColor;
                }
                else {
                    const hslColor = (_b = colorValue.hsl) !== null && _b !== void 0 ? _b : color.value;
                    if (hslColor.h !== undefined && hslColor.l !== undefined) {
                        res = hslToRgb(hslColor);
                    }
                    else {
                        const hsvColor = (_c = colorValue.hsv) !== null && _c !== void 0 ? _c : color.value;
                        if (hsvColor.h !== undefined && hsvColor.v !== undefined) {
                            res = hsvToRgb(hsvColor);
                        }
                    }
                }
            }
        }
        return res;
    }
    function colorToHsl(color, index, useIndex = true) {
        const rgb = colorToRgb(color, index, useIndex);
        return rgb !== undefined ? rgbToHsl(rgb) : undefined;
    }
    function rgbToHsl(color) {
        const r1 = color.r / 255, g1 = color.g / 255, b1 = color.b / 255;
        const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
        const res = {
            h: 0,
            l: (max + min) / 2,
            s: 0,
        };
        if (max !== min) {
            res.s = res.l < 0.5 ? (max - min) / (max + min) : (max - min) / (2.0 - max - min);
            res.h =
                r1 === max
                    ? (g1 - b1) / (max - min)
                    : (res.h = g1 === max ? 2.0 + (b1 - r1) / (max - min) : 4.0 + (r1 - g1) / (max - min));
        }
        res.l *= 100;
        res.s *= 100;
        res.h *= 60;
        if (res.h < 0) {
            res.h += 360;
        }
        return res;
    }
    function stringToAlpha(input) {
        var _a;
        return (_a = stringToRgba(input)) === null || _a === void 0 ? void 0 : _a.a;
    }
    function stringToRgb(input) {
        return stringToRgba(input);
    }
    function hslToRgb(hsl) {
        const result = { b: 0, g: 0, r: 0 }, hslPercent = {
            h: hsl.h / 360,
            l: hsl.l / 100,
            s: hsl.s / 100,
        };
        if (hslPercent.s === 0) {
            result.b = hslPercent.l;
            result.g = hslPercent.l;
            result.r = hslPercent.l;
        }
        else {
            const q = hslPercent.l < 0.5
                ? hslPercent.l * (1 + hslPercent.s)
                : hslPercent.l + hslPercent.s - hslPercent.l * hslPercent.s, p = 2 * hslPercent.l - q;
            result.r = hue2rgb(p, q, hslPercent.h + 1 / 3);
            result.g = hue2rgb(p, q, hslPercent.h);
            result.b = hue2rgb(p, q, hslPercent.h - 1 / 3);
        }
        result.r = Math.floor(result.r * 255);
        result.g = Math.floor(result.g * 255);
        result.b = Math.floor(result.b * 255);
        return result;
    }
    function hslaToRgba(hsla) {
        const rgbResult = hslToRgb(hsla);
        return {
            a: hsla.a,
            b: rgbResult.b,
            g: rgbResult.g,
            r: rgbResult.r,
        };
    }
    function hsvToRgb(hsv) {
        const result = { b: 0, g: 0, r: 0 }, hsvPercent = {
            h: hsv.h / 60,
            s: hsv.s / 100,
            v: hsv.v / 100,
        };
        const c = hsvPercent.v * hsvPercent.s, x = c * (1 - Math.abs((hsvPercent.h % 2) - 1));
        let tempRgb;
        if (hsvPercent.h >= 0 && hsvPercent.h <= 1) {
            tempRgb = {
                r: c,
                g: x,
                b: 0,
            };
        }
        else if (hsvPercent.h > 1 && hsvPercent.h <= 2) {
            tempRgb = {
                r: x,
                g: c,
                b: 0,
            };
        }
        else if (hsvPercent.h > 2 && hsvPercent.h <= 3) {
            tempRgb = {
                r: 0,
                g: c,
                b: x,
            };
        }
        else if (hsvPercent.h > 3 && hsvPercent.h <= 4) {
            tempRgb = {
                r: 0,
                g: x,
                b: c,
            };
        }
        else if (hsvPercent.h > 4 && hsvPercent.h <= 5) {
            tempRgb = {
                r: x,
                g: 0,
                b: c,
            };
        }
        else if (hsvPercent.h > 5 && hsvPercent.h <= 6) {
            tempRgb = {
                r: c,
                g: 0,
                b: x,
            };
        }
        if (tempRgb) {
            const m = hsvPercent.v - c;
            result.r = Math.floor((tempRgb.r + m) * 255);
            result.g = Math.floor((tempRgb.g + m) * 255);
            result.b = Math.floor((tempRgb.b + m) * 255);
        }
        return result;
    }
    function hsvaToRgba(hsva) {
        const rgbResult = hsvToRgb(hsva);
        return {
            a: hsva.a,
            b: rgbResult.b,
            g: rgbResult.g,
            r: rgbResult.r,
        };
    }
    function getRandomRgbColor(min) {
        const fixedMin = min !== null && min !== void 0 ? min : 0;
        return {
            b: Math.floor(randomInRange(setRangeValue(fixedMin, 256))),
            g: Math.floor(randomInRange(setRangeValue(fixedMin, 256))),
            r: Math.floor(randomInRange(setRangeValue(fixedMin, 256))),
        };
    }
    function getStyleFromRgb(color, opacity) {
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity !== null && opacity !== void 0 ? opacity : 1})`;
    }
    function getStyleFromHsl(color, opacity) {
        return `hsla(${color.h}, ${color.s}%, ${color.l}%, ${opacity !== null && opacity !== void 0 ? opacity : 1})`;
    }
    function colorMix(color1, color2, size1, size2) {
        let rgb1 = color1, rgb2 = color2;
        if (rgb1.r === undefined) {
            rgb1 = hslToRgb(color1);
        }
        if (rgb2.r === undefined) {
            rgb2 = hslToRgb(color2);
        }
        return {
            b: mix(rgb1.b, rgb2.b, size1, size2),
            g: mix(rgb1.g, rgb2.g, size1, size2),
            r: mix(rgb1.r, rgb2.r, size1, size2),
        };
    }
    function getLinkColor(p1, p2, linkColor) {
        var _a, _b;
        if (linkColor === randomColorValue) {
            return getRandomRgbColor();
        }
        else if (linkColor === "mid") {
            const sourceColor = (_a = p1.getFillColor()) !== null && _a !== void 0 ? _a : p1.getStrokeColor(), destColor = (_b = p2 === null || p2 === void 0 ? void 0 : p2.getFillColor()) !== null && _b !== void 0 ? _b : p2 === null || p2 === void 0 ? void 0 : p2.getStrokeColor();
            if (sourceColor && destColor && p2) {
                return colorMix(sourceColor, destColor, p1.getRadius(), p2.getRadius());
            }
            else {
                const hslColor = sourceColor !== null && sourceColor !== void 0 ? sourceColor : destColor;
                if (hslColor) {
                    return hslToRgb(hslColor);
                }
            }
        }
        else {
            return linkColor;
        }
    }
    function getLinkRandomColor(optColor, blink, consent) {
        const color = typeof optColor === "string" ? optColor : optColor.value;
        if (color === randomColorValue) {
            if (consent) {
                return colorToRgb({
                    value: color,
                });
            }
            else if (blink) {
                return randomColorValue;
            }
            else {
                return midColorValue;
            }
        }
        else {
            return colorToRgb({
                value: color,
            });
        }
    }
    function getHslFromAnimation(animation) {
        return animation !== undefined
            ? {
                h: animation.h.value,
                s: animation.s.value,
                l: animation.l.value,
            }
            : undefined;
    }
    function getHslAnimationFromHsl(hsl, animationOptions, reduceFactor) {
        const resColor = {
            h: {
                enable: false,
                value: hsl.h,
            },
            s: {
                enable: false,
                value: hsl.s,
            },
            l: {
                enable: false,
                value: hsl.l,
            },
        };
        if (animationOptions) {
            setColorAnimation(resColor.h, animationOptions.h, reduceFactor);
            setColorAnimation(resColor.s, animationOptions.s, reduceFactor);
            setColorAnimation(resColor.l, animationOptions.l, reduceFactor);
        }
        return resColor;
    }
    function setColorAnimation(colorValue, colorAnimation, reduceFactor) {
        colorValue.enable = colorAnimation.enable;
        if (colorValue.enable) {
            colorValue.velocity = (getRangeValue(colorAnimation.speed) / 100) * reduceFactor;
            if (colorAnimation.sync) {
                return;
            }
            colorValue.status = 0;
            colorValue.velocity *= Math.random();
            if (colorValue.value) {
                colorValue.value *= Math.random();
            }
        }
        else {
            colorValue.velocity = 0;
        }
    }

    function drawLine(context, begin, end) {
        context.beginPath();
        context.moveTo(begin.x, begin.y);
        context.lineTo(end.x, end.y);
        context.closePath();
    }
    function drawTriangle(context, p1, p2, p3) {
        context.beginPath();
        context.moveTo(p1.x, p1.y);
        context.lineTo(p2.x, p2.y);
        context.lineTo(p3.x, p3.y);
        context.closePath();
    }
    function paintBase(context, dimension, baseColor) {
        context.save();
        context.fillStyle = baseColor !== null && baseColor !== void 0 ? baseColor : "rgba(0,0,0,0)";
        context.fillRect(0, 0, dimension.width, dimension.height);
        context.restore();
    }
    function clear(context, dimension) {
        context.clearRect(0, 0, dimension.width, dimension.height);
    }
    function drawConnectLine(context, width, lineStyle, begin, end) {
        context.save();
        drawLine(context, begin, end);
        context.lineWidth = width;
        context.strokeStyle = lineStyle;
        context.stroke();
        context.restore();
    }
    function gradient(context, p1, p2, opacity) {
        const gradStop = Math.floor(p2.getRadius() / p1.getRadius()), color1 = p1.getFillColor(), color2 = p2.getFillColor();
        if (!color1 || !color2) {
            return;
        }
        const sourcePos = p1.getPosition(), destPos = p2.getPosition(), midRgb = colorMix(color1, color2, p1.getRadius(), p2.getRadius()), grad = context.createLinearGradient(sourcePos.x, sourcePos.y, destPos.x, destPos.y);
        grad.addColorStop(0, getStyleFromHsl(color1, opacity));
        grad.addColorStop(gradStop > 1 ? 1 : gradStop, getStyleFromRgb(midRgb, opacity));
        grad.addColorStop(1, getStyleFromHsl(color2, opacity));
        return grad;
    }
    function drawGrabLine(context, width, begin, end, colorLine, opacity) {
        context.save();
        drawLine(context, begin, end);
        context.strokeStyle = getStyleFromRgb(colorLine, opacity);
        context.lineWidth = width;
        context.stroke();
        context.restore();
    }
    function drawParticle(container, context, particle, delta, colorStyles, backgroundMask, composite, radius, opacity, shadow) {
        var _a, _b, _c, _d;
        const pos = particle.getPosition(), tiltOptions = particle.options.tilt, rollOptions = particle.options.roll;
        context.save();
        if (tiltOptions.enable || rollOptions.enable) {
            const roll = rollOptions.enable && particle.roll, tilt = tiltOptions.enable && particle.tilt, rollHorizontal = roll && (rollOptions.mode === "horizontal" || rollOptions.mode === "both"), rollVertical = roll && (rollOptions.mode === "vertical" || rollOptions.mode === "both");
            context.setTransform(rollHorizontal ? Math.cos(particle.roll.angle) : 1, tilt ? Math.cos(particle.tilt.value) * particle.tilt.cosDirection : 0, tilt ? Math.sin(particle.tilt.value) * particle.tilt.sinDirection : 0, rollVertical ? Math.sin(particle.roll.angle) : 1, pos.x, pos.y);
        }
        else {
            context.translate(pos.x, pos.y);
        }
        context.beginPath();
        const angle = ((_b = (_a = particle.rotate) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 0) + (particle.options.rotate.path ? particle.velocity.angle : 0);
        if (angle !== 0) {
            context.rotate(angle);
        }
        if (backgroundMask) {
            context.globalCompositeOperation = composite;
        }
        const shadowColor = particle.shadowColor;
        if (shadow.enable && shadowColor) {
            context.shadowBlur = shadow.blur;
            context.shadowColor = getStyleFromRgb(shadowColor);
            context.shadowOffsetX = shadow.offset.x;
            context.shadowOffsetY = shadow.offset.y;
        }
        if (colorStyles.fill) {
            context.fillStyle = colorStyles.fill;
        }
        const stroke = particle.stroke;
        context.lineWidth = (_c = particle.strokeWidth) !== null && _c !== void 0 ? _c : 0;
        if (colorStyles.stroke) {
            context.strokeStyle = colorStyles.stroke;
        }
        drawShape(container, context, particle, radius, opacity, delta);
        if (((_d = stroke === null || stroke === void 0 ? void 0 : stroke.width) !== null && _d !== void 0 ? _d : 0) > 0) {
            context.stroke();
        }
        if (particle.close) {
            context.closePath();
        }
        if (particle.fill) {
            context.fill();
        }
        context.restore();
        context.save();
        if (tiltOptions.enable && particle.tilt) {
            context.setTransform(1, Math.cos(particle.tilt.value) * particle.tilt.cosDirection, Math.sin(particle.tilt.value) * particle.tilt.sinDirection, 1, pos.x, pos.y);
        }
        else {
            context.translate(pos.x, pos.y);
        }
        if (angle !== 0) {
            context.rotate(angle);
        }
        if (backgroundMask) {
            context.globalCompositeOperation = composite;
        }
        drawShapeAfterEffect(container, context, particle, radius, opacity, delta);
        context.restore();
    }
    function drawShape(container, context, particle, radius, opacity, delta) {
        if (!particle.shape) {
            return;
        }
        const drawer = container.drawers.get(particle.shape);
        if (!drawer) {
            return;
        }
        drawer.draw(context, particle, radius, opacity, delta, container.retina.pixelRatio);
    }
    function drawShapeAfterEffect(container, context, particle, radius, opacity, delta) {
        if (!particle.shape) {
            return;
        }
        const drawer = container.drawers.get(particle.shape);
        if (!(drawer === null || drawer === void 0 ? void 0 : drawer.afterEffect)) {
            return;
        }
        drawer.afterEffect(context, particle, radius, opacity, delta, container.retina.pixelRatio);
    }
    function drawPlugin(context, plugin, delta) {
        if (!plugin.draw) {
            return;
        }
        context.save();
        plugin.draw(context, delta);
        context.restore();
    }
    function drawParticlePlugin(context, plugin, particle, delta) {
        if (!plugin.drawParticle) {
            return;
        }
        context.save();
        plugin.drawParticle(context, particle, delta);
        context.restore();
    }
    function alterHsl(color, type, value) {
        return {
            h: color.h,
            s: color.s,
            l: color.l + (type === "darken" ? -1 : 1) * value,
        };
    }

    class Canvas {
        constructor(container) {
            this.container = container;
            this.size = {
                height: 0,
                width: 0,
            };
            this.context = null;
            this.generatedCanvas = false;
        }
        init() {
            this.resize();
            this.initStyle();
            this.initCover();
            this.initTrail();
            this.initBackground();
            this.paint();
        }
        loadCanvas(canvas) {
            var _a;
            if (this.generatedCanvas) {
                (_a = this.element) === null || _a === void 0 ? void 0 : _a.remove();
            }
            this.generatedCanvas =
                canvas.dataset && generatedAttribute in canvas.dataset
                    ? canvas.dataset[generatedAttribute] === "true"
                    : this.generatedCanvas;
            this.element = canvas;
            this.originalStyle = deepExtend({}, this.element.style);
            this.size.height = canvas.offsetHeight;
            this.size.width = canvas.offsetWidth;
            this.context = this.element.getContext("2d");
            this.container.retina.init();
            this.initBackground();
        }
        destroy() {
            var _a;
            if (this.generatedCanvas) {
                (_a = this.element) === null || _a === void 0 ? void 0 : _a.remove();
            }
            this.draw((ctx) => {
                clear(ctx, this.size);
            });
        }
        paint() {
            const options = this.container.actualOptions;
            this.draw((ctx) => {
                if (options.backgroundMask.enable && options.backgroundMask.cover) {
                    clear(ctx, this.size);
                    this.paintBase(this.coverColorStyle);
                }
                else {
                    this.paintBase();
                }
            });
        }
        clear() {
            const options = this.container.actualOptions, trail = options.particles.move.trail;
            if (options.backgroundMask.enable) {
                this.paint();
            }
            else if (trail.enable && trail.length > 0 && this.trailFillColor) {
                this.paintBase(getStyleFromRgb(this.trailFillColor, 1 / trail.length));
            }
            else {
                this.draw((ctx) => {
                    clear(ctx, this.size);
                });
            }
        }
        async windowResize() {
            if (!this.element) {
                return;
            }
            this.resize();
            const container = this.container, needsRefresh = container.updateActualOptions();
            container.particles.setDensity();
            for (const [, plugin] of container.plugins) {
                if (plugin.resize !== undefined) {
                    plugin.resize();
                }
            }
            if (needsRefresh) {
                await container.refresh();
            }
        }
        resize() {
            if (!this.element) {
                return;
            }
            const container = this.container, pxRatio = container.retina.pixelRatio, size = container.canvas.size, newSize = {
                width: this.element.offsetWidth * pxRatio,
                height: this.element.offsetHeight * pxRatio,
            };
            if (newSize.height === size.height &&
                newSize.width === size.width &&
                newSize.height === this.element.height &&
                newSize.width === this.element.width) {
                return;
            }
            const oldSize = Object.assign({}, size);
            this.element.width = size.width = this.element.offsetWidth * pxRatio;
            this.element.height = size.height = this.element.offsetHeight * pxRatio;
            if (this.container.started) {
                this.resizeFactor = {
                    width: size.width / oldSize.width,
                    height: size.height / oldSize.height,
                };
            }
        }
        drawConnectLine(p1, p2) {
            this.draw((ctx) => {
                var _a;
                const lineStyle = this.lineStyle(p1, p2);
                if (!lineStyle) {
                    return;
                }
                const pos1 = p1.getPosition(), pos2 = p2.getPosition();
                drawConnectLine(ctx, (_a = p1.retina.linksWidth) !== null && _a !== void 0 ? _a : this.container.retina.linksWidth, lineStyle, pos1, pos2);
            });
        }
        drawGrabLine(particle, lineColor, opacity, mousePos) {
            const container = this.container;
            this.draw((ctx) => {
                var _a;
                const beginPos = particle.getPosition();
                drawGrabLine(ctx, (_a = particle.retina.linksWidth) !== null && _a !== void 0 ? _a : container.retina.linksWidth, beginPos, mousePos, lineColor, opacity);
            });
        }
        drawParticle(particle, delta) {
            var _a, _b, _c, _d, _e, _f;
            if (particle.spawning || particle.destroyed) {
                return;
            }
            const radius = particle.getRadius();
            if (radius <= 0) {
                return;
            }
            const pfColor = particle.getFillColor(), psColor = (_a = particle.getStrokeColor()) !== null && _a !== void 0 ? _a : pfColor;
            if (!pfColor && !psColor) {
                return;
            }
            let [fColor, sColor] = this.getPluginParticleColors(particle);
            if (!fColor || !sColor) {
                if (!fColor) {
                    fColor = pfColor ? pfColor : undefined;
                }
                if (!sColor) {
                    sColor = psColor ? psColor : undefined;
                }
            }
            const options = this.container.actualOptions, zIndexOptions = particle.options.zIndex, zOpacityFactor = (1 - particle.zIndexFactor) ** zIndexOptions.opacityRate, opacity = (_d = (_b = particle.bubble.opacity) !== null && _b !== void 0 ? _b : (_c = particle.opacity) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : 1, strokeOpacity = (_f = (_e = particle.stroke) === null || _e === void 0 ? void 0 : _e.opacity) !== null && _f !== void 0 ? _f : opacity, zOpacity = opacity * zOpacityFactor, zStrokeOpacity = strokeOpacity * zOpacityFactor;
            const colorStyles = {
                fill: fColor ? getStyleFromHsl(fColor, zOpacity) : undefined,
            };
            colorStyles.stroke = sColor ? getStyleFromHsl(sColor, zStrokeOpacity) : colorStyles.fill;
            this.draw((ctx) => {
                const zSizeFactor = (1 - particle.zIndexFactor) ** zIndexOptions.sizeRate, container = this.container;
                for (const updater of container.particles.updaters) {
                    if (updater.beforeDraw) {
                        updater.beforeDraw(particle);
                    }
                    if (updater.getColorStyles) {
                        const { fill, stroke } = updater.getColorStyles(particle, ctx, radius, zOpacity);
                        if (fill) {
                            colorStyles.fill = fill;
                        }
                        if (stroke) {
                            colorStyles.stroke = stroke;
                        }
                    }
                }
                drawParticle(container, ctx, particle, delta, colorStyles, options.backgroundMask.enable, options.backgroundMask.composite, radius * zSizeFactor, zOpacity, particle.options.shadow);
                for (const updater of container.particles.updaters) {
                    if (updater.afterDraw) {
                        updater.afterDraw(particle);
                    }
                }
            });
        }
        drawPlugin(plugin, delta) {
            this.draw((ctx) => {
                drawPlugin(ctx, plugin, delta);
            });
        }
        drawParticlePlugin(plugin, particle, delta) {
            this.draw((ctx) => {
                drawParticlePlugin(ctx, plugin, particle, delta);
            });
        }
        initBackground() {
            const options = this.container.actualOptions, background = options.background, element = this.element, elementStyle = element === null || element === void 0 ? void 0 : element.style;
            if (!elementStyle) {
                return;
            }
            if (background.color) {
                const color = colorToRgb(background.color);
                elementStyle.backgroundColor = color ? getStyleFromRgb(color, background.opacity) : "";
            }
            else {
                elementStyle.backgroundColor = "";
            }
            elementStyle.backgroundImage = background.image || "";
            elementStyle.backgroundPosition = background.position || "";
            elementStyle.backgroundRepeat = background.repeat || "";
            elementStyle.backgroundSize = background.size || "";
        }
        draw(cb) {
            if (!this.context) {
                return;
            }
            return cb(this.context);
        }
        initCover() {
            const options = this.container.actualOptions, cover = options.backgroundMask.cover, color = cover.color, coverRgb = colorToRgb(color);
            if (coverRgb) {
                const coverColor = {
                    r: coverRgb.r,
                    g: coverRgb.g,
                    b: coverRgb.b,
                    a: cover.opacity,
                };
                this.coverColorStyle = getStyleFromRgb(coverColor, coverColor.a);
            }
        }
        initTrail() {
            const options = this.container.actualOptions, trail = options.particles.move.trail, fillColor = colorToRgb(trail.fillColor);
            if (fillColor) {
                const trail = options.particles.move.trail;
                this.trailFillColor = {
                    r: fillColor.r,
                    g: fillColor.g,
                    b: fillColor.b,
                    a: 1 / trail.length,
                };
            }
        }
        getPluginParticleColors(particle) {
            let fColor, sColor;
            for (const [, plugin] of this.container.plugins) {
                if (!fColor && plugin.particleFillColor) {
                    fColor = colorToHsl(plugin.particleFillColor(particle));
                }
                if (!sColor && plugin.particleStrokeColor) {
                    sColor = colorToHsl(plugin.particleStrokeColor(particle));
                }
                if (fColor && sColor) {
                    break;
                }
            }
            return [fColor, sColor];
        }
        initStyle() {
            const element = this.element, options = this.container.actualOptions;
            if (!element) {
                return;
            }
            const originalStyle = this.originalStyle;
            if (options.fullScreen.enable) {
                this.originalStyle = deepExtend({}, element.style);
                element.style.setProperty("position", "fixed", "important");
                element.style.setProperty("z-index", options.fullScreen.zIndex.toString(10), "important");
                element.style.setProperty("top", "0", "important");
                element.style.setProperty("left", "0", "important");
                element.style.setProperty("width", "100%", "important");
                element.style.setProperty("height", "100%", "important");
            }
            else if (originalStyle) {
                element.style.position = originalStyle.position;
                element.style.zIndex = originalStyle.zIndex;
                element.style.top = originalStyle.top;
                element.style.left = originalStyle.left;
                element.style.width = originalStyle.width;
                element.style.height = originalStyle.height;
            }
            for (const key in options.style) {
                if (!key || !options.style) {
                    continue;
                }
                const value = options.style[key];
                if (!value) {
                    continue;
                }
                element.style.setProperty(key, value, "important");
            }
        }
        paintBase(baseColor) {
            this.draw((ctx) => {
                paintBase(ctx, this.size, baseColor);
            });
        }
        lineStyle(p1, p2) {
            return this.draw((ctx) => {
                const options = this.container.actualOptions, connectOptions = options.interactivity.modes.connect;
                return gradient(ctx, p1, p2, connectOptions.links.opacity);
            });
        }
    }

    function manageListener(element, event, handler, add, options) {
        if (add) {
            let addOptions = { passive: true };
            if (typeof options === "boolean") {
                addOptions.capture = options;
            }
            else if (options !== undefined) {
                addOptions = options;
            }
            element.addEventListener(event, handler, addOptions);
        }
        else {
            const removeOptions = options;
            element.removeEventListener(event, handler, removeOptions);
        }
    }
    class EventListeners {
        constructor(container) {
            this.container = container;
            this.canPush = true;
            this.mouseMoveHandler = (e) => this.mouseTouchMove(e);
            this.touchStartHandler = (e) => this.mouseTouchMove(e);
            this.touchMoveHandler = (e) => this.mouseTouchMove(e);
            this.touchEndHandler = () => this.mouseTouchFinish();
            this.mouseLeaveHandler = () => this.mouseTouchFinish();
            this.touchCancelHandler = () => this.mouseTouchFinish();
            this.touchEndClickHandler = (e) => this.mouseTouchClick(e);
            this.mouseUpHandler = (e) => this.mouseTouchClick(e);
            this.mouseDownHandler = () => this.mouseDown();
            this.visibilityChangeHandler = () => this.handleVisibilityChange();
            this.themeChangeHandler = (e) => this.handleThemeChange(e);
            this.oldThemeChangeHandler = (e) => this.handleThemeChange(e);
            this.resizeHandler = () => this.handleWindowResize();
        }
        addListeners() {
            this.manageListeners(true);
        }
        removeListeners() {
            this.manageListeners(false);
        }
        manageListeners(add) {
            var _a;
            const container = this.container, options = container.actualOptions, detectType = options.interactivity.detectsOn;
            let mouseLeaveTmpEvent = mouseLeaveEvent;
            if (detectType === "window") {
                container.interactivity.element = window;
                mouseLeaveTmpEvent = mouseOutEvent;
            }
            else if (detectType === "parent" && container.canvas.element) {
                const canvasEl = container.canvas.element;
                container.interactivity.element = (_a = canvasEl.parentElement) !== null && _a !== void 0 ? _a : canvasEl.parentNode;
            }
            else {
                container.interactivity.element = container.canvas.element;
            }
            const mediaMatch = !isSsr() && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)");
            if (mediaMatch) {
                if (mediaMatch.addEventListener !== undefined) {
                    manageListener(mediaMatch, "change", this.themeChangeHandler, add);
                }
                else if (mediaMatch.addListener !== undefined) {
                    if (add) {
                        mediaMatch.addListener(this.oldThemeChangeHandler);
                    }
                    else {
                        mediaMatch.removeListener(this.oldThemeChangeHandler);
                    }
                }
            }
            const interactivityEl = container.interactivity.element;
            if (!interactivityEl) {
                return;
            }
            const html = interactivityEl;
            if (options.interactivity.events.onHover.enable || options.interactivity.events.onClick.enable) {
                manageListener(interactivityEl, mouseMoveEvent, this.mouseMoveHandler, add);
                manageListener(interactivityEl, touchStartEvent, this.touchStartHandler, add);
                manageListener(interactivityEl, touchMoveEvent, this.touchMoveHandler, add);
                if (!options.interactivity.events.onClick.enable) {
                    manageListener(interactivityEl, touchEndEvent, this.touchEndHandler, add);
                }
                else {
                    manageListener(interactivityEl, touchEndEvent, this.touchEndClickHandler, add);
                    manageListener(interactivityEl, mouseUpEvent, this.mouseUpHandler, add);
                    manageListener(interactivityEl, mouseDownEvent, this.mouseDownHandler, add);
                }
                manageListener(interactivityEl, mouseLeaveTmpEvent, this.mouseLeaveHandler, add);
                manageListener(interactivityEl, touchCancelEvent, this.touchCancelHandler, add);
            }
            if (container.canvas.element) {
                container.canvas.element.style.pointerEvents = html === container.canvas.element ? "initial" : "none";
            }
            if (options.interactivity.events.resize) {
                if (typeof ResizeObserver !== "undefined") {
                    if (this.resizeObserver && !add) {
                        if (container.canvas.element) {
                            this.resizeObserver.unobserve(container.canvas.element);
                        }
                        this.resizeObserver.disconnect();
                        delete this.resizeObserver;
                    }
                    else if (!this.resizeObserver && add && container.canvas.element) {
                        this.resizeObserver = new ResizeObserver((entries) => {
                            const entry = entries.find((e) => e.target === container.canvas.element);
                            if (!entry) {
                                return;
                            }
                            this.handleWindowResize();
                        });
                        this.resizeObserver.observe(container.canvas.element);
                    }
                }
                else {
                    manageListener(window, resizeEvent, this.resizeHandler, add);
                }
            }
            if (document) {
                manageListener(document, visibilityChangeEvent, this.visibilityChangeHandler, add, false);
            }
        }
        handleWindowResize() {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
                delete this.resizeTimeout;
            }
            this.resizeTimeout = setTimeout(async () => { var _a; return (_a = this.container.canvas) === null || _a === void 0 ? void 0 : _a.windowResize(); }, 500);
        }
        handleVisibilityChange() {
            const container = this.container, options = container.actualOptions;
            this.mouseTouchFinish();
            if (!options.pauseOnBlur) {
                return;
            }
            if (document === null || document === void 0 ? void 0 : document.hidden) {
                container.pageHidden = true;
                container.pause();
            }
            else {
                container.pageHidden = false;
                if (container.getAnimationStatus()) {
                    container.play(true);
                }
                else {
                    container.draw(true);
                }
            }
        }
        mouseDown() {
            const interactivity = this.container.interactivity;
            if (interactivity) {
                const mouse = interactivity.mouse;
                mouse.clicking = true;
                mouse.downPosition = mouse.position;
            }
        }
        mouseTouchMove(e) {
            var _a, _b, _c, _d, _e, _f, _g;
            const container = this.container, options = container.actualOptions;
            if (!((_a = container.interactivity) === null || _a === void 0 ? void 0 : _a.element)) {
                return;
            }
            container.interactivity.mouse.inside = true;
            let pos;
            const canvas = container.canvas.element;
            if (e.type.startsWith("mouse")) {
                this.canPush = true;
                const mouseEvent = e;
                if (container.interactivity.element === window) {
                    if (canvas) {
                        const clientRect = canvas.getBoundingClientRect();
                        pos = {
                            x: mouseEvent.clientX - clientRect.left,
                            y: mouseEvent.clientY - clientRect.top,
                        };
                    }
                }
                else if (options.interactivity.detectsOn === "parent") {
                    const source = mouseEvent.target;
                    const target = mouseEvent.currentTarget;
                    const canvasEl = container.canvas.element;
                    if (source && target && canvasEl) {
                        const sourceRect = source.getBoundingClientRect();
                        const targetRect = target.getBoundingClientRect();
                        const canvasRect = canvasEl.getBoundingClientRect();
                        pos = {
                            x: mouseEvent.offsetX + 2 * sourceRect.left - (targetRect.left + canvasRect.left),
                            y: mouseEvent.offsetY + 2 * sourceRect.top - (targetRect.top + canvasRect.top),
                        };
                    }
                    else {
                        pos = {
                            x: (_b = mouseEvent.offsetX) !== null && _b !== void 0 ? _b : mouseEvent.clientX,
                            y: (_c = mouseEvent.offsetY) !== null && _c !== void 0 ? _c : mouseEvent.clientY,
                        };
                    }
                }
                else {
                    if (mouseEvent.target === container.canvas.element) {
                        pos = {
                            x: (_d = mouseEvent.offsetX) !== null && _d !== void 0 ? _d : mouseEvent.clientX,
                            y: (_e = mouseEvent.offsetY) !== null && _e !== void 0 ? _e : mouseEvent.clientY,
                        };
                    }
                }
            }
            else {
                this.canPush = e.type !== "touchmove";
                const touchEvent = e;
                const lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
                const canvasRect = canvas === null || canvas === void 0 ? void 0 : canvas.getBoundingClientRect();
                pos = {
                    x: lastTouch.clientX - ((_f = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.left) !== null && _f !== void 0 ? _f : 0),
                    y: lastTouch.clientY - ((_g = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.top) !== null && _g !== void 0 ? _g : 0),
                };
            }
            const pxRatio = container.retina.pixelRatio;
            if (pos) {
                pos.x *= pxRatio;
                pos.y *= pxRatio;
            }
            container.interactivity.mouse.position = pos;
            container.interactivity.status = mouseMoveEvent;
        }
        mouseTouchFinish() {
            const interactivity = this.container.interactivity;
            if (!interactivity) {
                return;
            }
            const mouse = interactivity.mouse;
            delete mouse.position;
            delete mouse.clickPosition;
            delete mouse.downPosition;
            interactivity.status = mouseLeaveEvent;
            mouse.inside = false;
            mouse.clicking = false;
        }
        mouseTouchClick(e) {
            const container = this.container, options = container.actualOptions, mouse = container.interactivity.mouse;
            mouse.inside = true;
            let handled = false;
            const mousePosition = mouse.position;
            if (!mousePosition || !options.interactivity.events.onClick.enable) {
                return;
            }
            for (const [, plugin] of container.plugins) {
                if (!plugin.clickPositionValid) {
                    continue;
                }
                handled = plugin.clickPositionValid(mousePosition);
                if (handled) {
                    break;
                }
            }
            if (!handled) {
                this.doMouseTouchClick(e);
            }
            mouse.clicking = false;
        }
        doMouseTouchClick(e) {
            const container = this.container, options = container.actualOptions;
            if (this.canPush) {
                const mousePos = container.interactivity.mouse.position;
                if (!mousePos) {
                    return;
                }
                container.interactivity.mouse.clickPosition = {
                    x: mousePos.x,
                    y: mousePos.y,
                };
                container.interactivity.mouse.clickTime = new Date().getTime();
                const onClick = options.interactivity.events.onClick;
                if (onClick.mode instanceof Array) {
                    for (const mode of onClick.mode) {
                        this.handleClickMode(mode);
                    }
                }
                else {
                    this.handleClickMode(onClick.mode);
                }
            }
            if (e.type === "touchend") {
                setTimeout(() => this.mouseTouchFinish(), 500);
            }
        }
        handleThemeChange(e) {
            const mediaEvent = e, themeName = mediaEvent.matches
                ? this.container.options.defaultDarkTheme
                : this.container.options.defaultLightTheme, theme = this.container.options.themes.find((theme) => theme.name === themeName);
            if (theme && theme.default.auto) {
                this.container.loadTheme(themeName);
            }
        }
        handleClickMode(mode) {
            this.container.handleClickMode(mode);
        }
    }

    class FrameManager {
        constructor(container) {
            this.container = container;
        }
        async nextFrame(timestamp) {
            var _a;
            try {
                const container = this.container;
                if (container.lastFrameTime !== undefined &&
                    timestamp < container.lastFrameTime + 1000 / container.fpsLimit) {
                    container.draw(false);
                    return;
                }
                (_a = container.lastFrameTime) !== null && _a !== void 0 ? _a : (container.lastFrameTime = timestamp);
                const deltaValue = timestamp - container.lastFrameTime, delta = {
                    value: deltaValue,
                    factor: (60 * deltaValue) / 1000,
                };
                container.lifeTime += delta.value;
                container.lastFrameTime = timestamp;
                if (deltaValue > 1000) {
                    container.draw(false);
                    return;
                }
                await container.particles.draw(delta);
                if (container.duration > 0 && container.lifeTime > container.duration) {
                    container.destroy();
                    return;
                }
                if (container.getAnimationStatus()) {
                    container.draw(false);
                }
            }
            catch (e) {
                console.error("tsParticles error in animation loop", e);
            }
        }
    }

    var __classPrivateFieldSet$d = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$b = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _InteractionManager_engine;
    class InteractionManager {
        constructor(engine, container) {
            this.container = container;
            _InteractionManager_engine.set(this, void 0);
            __classPrivateFieldSet$d(this, _InteractionManager_engine, engine, "f");
            this.externalInteractors = [];
            this.particleInteractors = [];
            this.init();
        }
        init() {
            const interactors = __classPrivateFieldGet$b(this, _InteractionManager_engine, "f").plugins.getInteractors(this.container, true);
            this.externalInteractors = [];
            this.particleInteractors = [];
            for (const interactor of interactors) {
                switch (interactor.type) {
                    case 0:
                        this.externalInteractors.push(interactor);
                        break;
                    case 1:
                        this.particleInteractors.push(interactor);
                        break;
                }
            }
        }
        async externalInteract(delta) {
            for (const interactor of this.externalInteractors) {
                if (interactor.isEnabled()) {
                    await interactor.interact(delta);
                }
            }
        }
        async particlesInteract(particle, delta) {
            for (const interactor of this.externalInteractors) {
                interactor.reset(particle);
            }
            for (const interactor of this.particleInteractors) {
                if (interactor.isEnabled(particle)) {
                    await interactor.interact(particle, delta);
                }
            }
        }
        handleClickMode(mode) {
            for (const interactor of this.externalInteractors) {
                if (interactor.handleClickMode) {
                    interactor.handleClickMode(mode);
                }
            }
        }
    }
    _InteractionManager_engine = new WeakMap();

    class Vector3d extends Vector {
        constructor(xOrCoords, y, z) {
            super(xOrCoords, y);
            if (typeof xOrCoords !== "number" && xOrCoords) {
                this.z = xOrCoords.z;
            }
            else if (z !== undefined) {
                this.z = z;
            }
            else {
                throw new Error("tsParticles - Vector not initialized correctly");
            }
        }
        static clone(source) {
            return Vector3d.create(source.x, source.y, source.z);
        }
        static create(x, y, z) {
            return new Vector3d(x, y, z);
        }
        static get origin() {
            return Vector3d.create(0, 0, 0);
        }
        add(v) {
            return v instanceof Vector3d ? Vector3d.create(this.x + v.x, this.y + v.y, this.z + v.z) : super.add(v);
        }
        addTo(v) {
            super.addTo(v);
            if (v instanceof Vector3d) {
                this.z += v.z;
            }
        }
        sub(v) {
            return v instanceof Vector3d ? Vector3d.create(this.x - v.x, this.y - v.y, this.z - v.z) : super.sub(v);
        }
        subFrom(v) {
            super.subFrom(v);
            if (v instanceof Vector3d) {
                this.z -= v.z;
            }
        }
        mult(n) {
            return Vector3d.create(this.x * n, this.y * n, this.z * n);
        }
        multTo(n) {
            super.multTo(n);
            this.z *= n;
        }
        div(n) {
            return Vector3d.create(this.x / n, this.y / n, this.z / n);
        }
        divTo(n) {
            super.divTo(n);
            this.z /= n;
        }
        copy() {
            return Vector3d.clone(this);
        }
        setTo(v) {
            super.setTo(v);
            const v3d = v;
            if (v3d.z !== undefined) {
                this.z = v3d.z;
            }
        }
    }

    var __classPrivateFieldSet$c = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$a = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Particle_engine;
    const fixOutMode = (data) => {
        if (!(isInArray(data.outMode, data.checkModes) || isInArray(data.outMode, data.checkModes))) {
            return;
        }
        if (data.coord > data.maxCoord - data.radius * 2) {
            data.setCb(-data.radius);
        }
        else if (data.coord < data.radius * 2) {
            data.setCb(data.radius);
        }
    };
    class Particle {
        constructor(engine, id, container, position, overrideOptions, group) {
            var _a, _b, _c, _d, _e, _f, _g;
            this.id = id;
            this.container = container;
            this.group = group;
            _Particle_engine.set(this, void 0);
            __classPrivateFieldSet$c(this, _Particle_engine, engine, "f");
            this.fill = true;
            this.close = true;
            this.lastPathTime = 0;
            this.destroyed = false;
            this.unbreakable = false;
            this.splitCount = 0;
            this.misplaced = false;
            this.retina = {
                maxDistance: {},
            };
            this.outType = "normal";
            this.ignoresResizeRatio = true;
            const pxRatio = container.retina.pixelRatio, mainOptions = container.actualOptions, particlesOptions = loadParticlesOptions(mainOptions.particles);
            const shapeType = particlesOptions.shape.type, reduceDuplicates = particlesOptions.reduceDuplicates;
            this.shape = shapeType instanceof Array ? itemFromArray(shapeType, this.id, reduceDuplicates) : shapeType;
            if (overrideOptions === null || overrideOptions === void 0 ? void 0 : overrideOptions.shape) {
                if (overrideOptions.shape.type) {
                    const overrideShapeType = overrideOptions.shape.type;
                    this.shape =
                        overrideShapeType instanceof Array
                            ? itemFromArray(overrideShapeType, this.id, reduceDuplicates)
                            : overrideShapeType;
                }
                const shapeOptions = new Shape();
                shapeOptions.load(overrideOptions.shape);
                if (this.shape) {
                    this.shapeData = this.loadShapeData(shapeOptions, reduceDuplicates);
                }
            }
            else {
                this.shapeData = this.loadShapeData(particlesOptions.shape, reduceDuplicates);
            }
            if (overrideOptions !== undefined) {
                particlesOptions.load(overrideOptions);
            }
            if (((_a = this.shapeData) === null || _a === void 0 ? void 0 : _a.particles) !== undefined) {
                particlesOptions.load((_b = this.shapeData) === null || _b === void 0 ? void 0 : _b.particles);
            }
            this.fill = (_d = (_c = this.shapeData) === null || _c === void 0 ? void 0 : _c.fill) !== null && _d !== void 0 ? _d : this.fill;
            this.close = (_f = (_e = this.shapeData) === null || _e === void 0 ? void 0 : _e.close) !== null && _f !== void 0 ? _f : this.close;
            this.options = particlesOptions;
            this.pathDelay = getValue(this.options.move.path.delay) * 1000;
            const zIndexValue = getRangeValue(this.options.zIndex.value);
            container.retina.initParticle(this);
            const sizeOptions = this.options.size, sizeRange = sizeOptions.value;
            this.size = {
                enable: sizeOptions.animation.enable,
                value: getRangeValue(sizeOptions.value) * container.retina.pixelRatio,
                max: getRangeMax(sizeRange) * pxRatio,
                min: getRangeMin(sizeRange) * pxRatio,
                loops: 0,
                maxLoops: getRangeValue(sizeOptions.animation.count),
            };
            const sizeAnimation = sizeOptions.animation;
            if (sizeAnimation.enable) {
                this.size.status = 0;
                switch (sizeAnimation.startValue) {
                    case "min":
                        this.size.value = this.size.min;
                        this.size.status = 0;
                        break;
                    case "random":
                        this.size.value = randomInRange(this.size) * pxRatio;
                        this.size.status = Math.random() >= 0.5 ? 0 : 1;
                        break;
                    case "max":
                    default:
                        this.size.value = this.size.max;
                        this.size.status = 1;
                        break;
                }
                this.size.velocity =
                    (((_g = this.retina.sizeAnimationSpeed) !== null && _g !== void 0 ? _g : container.retina.sizeAnimationSpeed) / 100) *
                        container.retina.reduceFactor;
                if (!sizeAnimation.sync) {
                    this.size.velocity *= Math.random();
                }
            }
            this.bubble = {
                inRange: false,
            };
            this.position = this.calcPosition(container, position, clamp(zIndexValue, 0, container.zLayers));
            this.initialPosition = this.position.copy();
            const canvasSize = container.canvas.size, moveCenterPerc = this.options.move.center;
            this.moveCenter = {
                x: (canvasSize.width * moveCenterPerc.x) / 100,
                y: (canvasSize.height * moveCenterPerc.y) / 100,
                radius: this.options.move.center.radius,
            };
            this.direction = getParticleDirectionAngle(this.options.move.direction, this.position, this.moveCenter);
            switch (this.options.move.direction) {
                case "inside":
                    this.outType = "inside";
                    break;
                case "outside":
                    this.outType = "outside";
                    break;
            }
            this.initialVelocity = this.calculateVelocity();
            this.velocity = this.initialVelocity.copy();
            this.moveDecay = 1 - getRangeValue(this.options.move.decay);
            const gravityOptions = this.options.move.gravity;
            this.gravity = {
                enable: gravityOptions.enable,
                acceleration: getRangeValue(gravityOptions.acceleration),
                inverse: gravityOptions.inverse,
            };
            this.offset = Vector.origin;
            const particles = container.particles;
            particles.needsSort = particles.needsSort || particles.lastZIndex < this.position.z;
            particles.lastZIndex = this.position.z;
            this.zIndexFactor = this.position.z / container.zLayers;
            this.sides = 24;
            let drawer = container.drawers.get(this.shape);
            if (!drawer) {
                drawer = __classPrivateFieldGet$a(this, _Particle_engine, "f").plugins.getShapeDrawer(this.shape);
                if (drawer) {
                    container.drawers.set(this.shape, drawer);
                }
            }
            if (drawer === null || drawer === void 0 ? void 0 : drawer.loadShape) {
                drawer === null || drawer === void 0 ? void 0 : drawer.loadShape(this);
            }
            const sideCountFunc = drawer === null || drawer === void 0 ? void 0 : drawer.getSidesCount;
            if (sideCountFunc) {
                this.sides = sideCountFunc(this);
            }
            this.life = this.loadLife();
            this.spawning = this.life.delay > 0;
            this.shadowColor = colorToRgb(this.options.shadow.color);
            for (const updater of container.particles.updaters) {
                if (updater.init) {
                    updater.init(this);
                }
            }
            for (const mover of container.particles.movers) {
                if (mover.init) {
                    mover.init(this);
                }
            }
            if (drawer && drawer.particleInit) {
                drawer.particleInit(container, this);
            }
            for (const [, plugin] of container.plugins) {
                if (plugin.particleCreated) {
                    plugin.particleCreated(this);
                }
            }
        }
        isVisible() {
            return !this.destroyed && !this.spawning && this.isInsideCanvas();
        }
        isInsideCanvas() {
            const radius = this.getRadius(), canvasSize = this.container.canvas.size;
            return (this.position.x >= -radius &&
                this.position.y >= -radius &&
                this.position.y <= canvasSize.height + radius &&
                this.position.x <= canvasSize.width + radius);
        }
        draw(delta) {
            const container = this.container;
            for (const [, plugin] of container.plugins) {
                container.canvas.drawParticlePlugin(plugin, this, delta);
            }
            container.canvas.drawParticle(this, delta);
        }
        getPosition() {
            return {
                x: this.position.x + this.offset.x,
                y: this.position.y + this.offset.y,
                z: this.position.z,
            };
        }
        getRadius() {
            var _a;
            return (_a = this.bubble.radius) !== null && _a !== void 0 ? _a : this.size.value;
        }
        getMass() {
            return (this.getRadius() ** 2 * Math.PI) / 2;
        }
        getFillColor() {
            var _a, _b;
            const color = (_a = this.bubble.color) !== null && _a !== void 0 ? _a : getHslFromAnimation(this.color);
            if (color && this.roll && (this.backColor || this.roll.alter)) {
                const backFactor = this.options.roll.mode === "both" ? 2 : 1, backSum = this.options.roll.mode === "horizontal" ? Math.PI / 2 : 0, rolled = Math.floor((((_b = this.roll.angle) !== null && _b !== void 0 ? _b : 0) + backSum) / (Math.PI / backFactor)) % 2;
                if (rolled) {
                    if (this.backColor) {
                        return this.backColor;
                    }
                    if (this.roll.alter) {
                        return alterHsl(color, this.roll.alter.type, this.roll.alter.value);
                    }
                }
            }
            return color;
        }
        getStrokeColor() {
            var _a, _b;
            return (_b = (_a = this.bubble.color) !== null && _a !== void 0 ? _a : getHslFromAnimation(this.strokeColor)) !== null && _b !== void 0 ? _b : this.getFillColor();
        }
        destroy(override) {
            this.destroyed = true;
            this.bubble.inRange = false;
            if (this.unbreakable) {
                return;
            }
            this.destroyed = true;
            this.bubble.inRange = false;
            for (const [, plugin] of this.container.plugins) {
                if (plugin.particleDestroyed) {
                    plugin.particleDestroyed(this, override);
                }
            }
            if (override) {
                return;
            }
            const destroyOptions = this.options.destroy;
            if (destroyOptions.mode === "split") {
                this.split();
            }
        }
        reset() {
            if (this.opacity) {
                this.opacity.loops = 0;
            }
            this.size.loops = 0;
        }
        split() {
            const splitOptions = this.options.destroy.split;
            if (splitOptions.count >= 0 && this.splitCount++ > splitOptions.count) {
                return;
            }
            const rate = getValue(splitOptions.rate);
            for (let i = 0; i < rate; i++) {
                this.container.particles.addSplitParticle(this);
            }
        }
        calcPosition(container, position, zIndex, tryCount = 0) {
            var _a, _b, _c, _d;
            for (const [, plugin] of container.plugins) {
                const pluginPos = plugin.particlePosition !== undefined ? plugin.particlePosition(position, this) : undefined;
                if (pluginPos !== undefined) {
                    return Vector3d.create(pluginPos.x, pluginPos.y, zIndex);
                }
            }
            const canvasSize = container.canvas.size, exactPosition = calcExactPositionOrRandomFromSize({
                size: canvasSize,
                position: position,
            }), pos = Vector3d.create(exactPosition.x, exactPosition.y, zIndex), radius = this.getRadius(), outModes = this.options.move.outModes, fixHorizontal = (outMode) => {
                fixOutMode({
                    outMode,
                    checkModes: ["bounce", "bounce-horizontal"],
                    coord: pos.x,
                    maxCoord: container.canvas.size.width,
                    setCb: (value) => (pos.x += value),
                    radius,
                });
            }, fixVertical = (outMode) => {
                fixOutMode({
                    outMode,
                    checkModes: ["bounce", "bounce-vertical"],
                    coord: pos.y,
                    maxCoord: container.canvas.size.height,
                    setCb: (value) => (pos.y += value),
                    radius,
                });
            };
            fixHorizontal((_a = outModes.left) !== null && _a !== void 0 ? _a : outModes.default);
            fixHorizontal((_b = outModes.right) !== null && _b !== void 0 ? _b : outModes.default);
            fixVertical((_c = outModes.top) !== null && _c !== void 0 ? _c : outModes.default);
            fixVertical((_d = outModes.bottom) !== null && _d !== void 0 ? _d : outModes.default);
            if (this.checkOverlap(pos, tryCount)) {
                return this.calcPosition(container, undefined, zIndex, tryCount + 1);
            }
            return pos;
        }
        checkOverlap(pos, tryCount = 0) {
            const collisionsOptions = this.options.collisions, radius = this.getRadius();
            if (!collisionsOptions.enable) {
                return false;
            }
            const overlapOptions = collisionsOptions.overlap;
            if (overlapOptions.enable) {
                return false;
            }
            const retries = overlapOptions.retries;
            if (retries >= 0 && tryCount > retries) {
                throw new Error("Particle is overlapping and can't be placed");
            }
            let overlaps = false;
            for (const particle of this.container.particles.array) {
                if (getDistance(pos, particle.position) < radius + particle.getRadius()) {
                    overlaps = true;
                    break;
                }
            }
            return overlaps;
        }
        calculateVelocity() {
            const baseVelocity = getParticleBaseVelocity(this.direction);
            const res = baseVelocity.copy();
            const moveOptions = this.options.move;
            if (moveOptions.direction === "inside" || moveOptions.direction === "outside") {
                return res;
            }
            const rad = (Math.PI / 180) * getRangeValue(moveOptions.angle.value);
            const radOffset = (Math.PI / 180) * getRangeValue(moveOptions.angle.offset);
            const range = {
                left: radOffset - rad / 2,
                right: radOffset + rad / 2,
            };
            if (!moveOptions.straight) {
                res.angle += randomInRange(setRangeValue(range.left, range.right));
            }
            if (moveOptions.random && typeof moveOptions.speed === "number") {
                res.length *= Math.random();
            }
            return res;
        }
        loadShapeData(shapeOptions, reduceDuplicates) {
            const shapeData = shapeOptions.options[this.shape];
            if (shapeData) {
                return deepExtend({}, shapeData instanceof Array ? itemFromArray(shapeData, this.id, reduceDuplicates) : shapeData);
            }
        }
        loadLife() {
            const container = this.container, particlesOptions = this.options, lifeOptions = particlesOptions.life, life = {
                delay: container.retina.reduceFactor
                    ? ((getRangeValue(lifeOptions.delay.value) * (lifeOptions.delay.sync ? 1 : Math.random())) /
                        container.retina.reduceFactor) *
                        1000
                    : 0,
                delayTime: 0,
                duration: container.retina.reduceFactor
                    ? ((getRangeValue(lifeOptions.duration.value) * (lifeOptions.duration.sync ? 1 : Math.random())) /
                        container.retina.reduceFactor) *
                        1000
                    : 0,
                time: 0,
                count: particlesOptions.life.count,
            };
            if (life.duration <= 0) {
                life.duration = -1;
            }
            if (life.count <= 0) {
                life.count = -1;
            }
            return life;
        }
    }
    _Particle_engine = new WeakMap();

    class Point {
        constructor(position, particle) {
            this.position = position;
            this.particle = particle;
        }
    }

    class Range {
        constructor(x, y) {
            this.position = {
                x: x,
                y: y,
            };
        }
    }

    class Circle extends Range {
        constructor(x, y, radius) {
            super(x, y);
            this.radius = radius;
        }
        contains(point) {
            return getDistance(point, this.position) <= this.radius;
        }
        intersects(range) {
            const rect = range, circle = range, pos1 = this.position, pos2 = range.position, xDist = Math.abs(pos2.x - pos1.x), yDist = Math.abs(pos2.y - pos1.y), r = this.radius;
            if (circle.radius !== undefined) {
                const rSum = r + circle.radius, dist = Math.sqrt(xDist * xDist + yDist + yDist);
                return rSum > dist;
            }
            else if (rect.size !== undefined) {
                const w = rect.size.width, h = rect.size.height, edges = Math.pow(xDist - w, 2) + Math.pow(yDist - h, 2);
                if (xDist > r + w || yDist > r + h) {
                    return false;
                }
                if (xDist <= w || yDist <= h) {
                    return true;
                }
                return edges <= r * r;
            }
            return false;
        }
    }

    class Rectangle extends Range {
        constructor(x, y, width, height) {
            super(x, y);
            this.size = {
                height: height,
                width: width,
            };
        }
        contains(point) {
            const w = this.size.width, h = this.size.height, pos = this.position;
            return point.x >= pos.x && point.x <= pos.x + w && point.y >= pos.y && point.y <= pos.y + h;
        }
        intersects(range) {
            const rect = range, circle = range, w = this.size.width, h = this.size.height, pos1 = this.position, pos2 = range.position;
            if (circle.radius !== undefined) {
                return circle.intersects(this);
            }
            if (!rect.size) {
                return false;
            }
            const size2 = rect.size, w2 = size2.width, h2 = size2.height;
            return pos2.x < pos1.x + w && pos2.x + w2 > pos1.x && pos2.y < pos1.y + h && pos2.y + h2 > pos1.y;
        }
    }

    class CircleWarp extends Circle {
        constructor(x, y, radius, canvasSize) {
            super(x, y, radius);
            this.canvasSize = canvasSize;
            this.canvasSize = Object.assign({}, canvasSize);
        }
        contains(point) {
            if (super.contains(point)) {
                return true;
            }
            const posNE = {
                x: point.x - this.canvasSize.width,
                y: point.y,
            };
            if (super.contains(posNE)) {
                return true;
            }
            const posSE = {
                x: point.x - this.canvasSize.width,
                y: point.y - this.canvasSize.height,
            };
            if (super.contains(posSE)) {
                return true;
            }
            const posSW = {
                x: point.x,
                y: point.y - this.canvasSize.height,
            };
            return super.contains(posSW);
        }
        intersects(range) {
            if (super.intersects(range)) {
                return true;
            }
            const rect = range, circle = range, newPos = {
                x: range.position.x - this.canvasSize.width,
                y: range.position.y - this.canvasSize.height,
            };
            if (circle.radius !== undefined) {
                const biggerCircle = new Circle(newPos.x, newPos.y, circle.radius * 2);
                return super.intersects(biggerCircle);
            }
            else if (rect.size !== undefined) {
                const rectSW = new Rectangle(newPos.x, newPos.y, rect.size.width * 2, rect.size.height * 2);
                return super.intersects(rectSW);
            }
            return false;
        }
    }

    class QuadTree {
        constructor(rectangle, capacity) {
            this.rectangle = rectangle;
            this.capacity = capacity;
            this.points = [];
            this.divided = false;
        }
        insert(point) {
            var _a, _b, _c, _d, _e;
            if (!this.rectangle.contains(point.position)) {
                return false;
            }
            if (this.points.length < this.capacity) {
                this.points.push(point);
                return true;
            }
            if (!this.divided) {
                this.subdivide();
            }
            return ((_e = (((_a = this.northEast) === null || _a === void 0 ? void 0 : _a.insert(point)) ||
                ((_b = this.northWest) === null || _b === void 0 ? void 0 : _b.insert(point)) ||
                ((_c = this.southEast) === null || _c === void 0 ? void 0 : _c.insert(point)) ||
                ((_d = this.southWest) === null || _d === void 0 ? void 0 : _d.insert(point)))) !== null && _e !== void 0 ? _e : false);
        }
        queryCircle(position, radius) {
            return this.query(new Circle(position.x, position.y, radius));
        }
        queryCircleWarp(position, radius, containerOrSize) {
            const container = containerOrSize, size = containerOrSize;
            return this.query(new CircleWarp(position.x, position.y, radius, container.canvas !== undefined ? container.canvas.size : size));
        }
        queryRectangle(position, size) {
            return this.query(new Rectangle(position.x, position.y, size.width, size.height));
        }
        query(range, found) {
            var _a, _b, _c, _d;
            const res = found !== null && found !== void 0 ? found : [];
            if (!range.intersects(this.rectangle)) {
                return [];
            }
            for (const p of this.points) {
                if (!range.contains(p.position) && getDistance(range.position, p.position) > p.particle.getRadius()) {
                    continue;
                }
                res.push(p.particle);
            }
            if (this.divided) {
                (_a = this.northEast) === null || _a === void 0 ? void 0 : _a.query(range, res);
                (_b = this.northWest) === null || _b === void 0 ? void 0 : _b.query(range, res);
                (_c = this.southEast) === null || _c === void 0 ? void 0 : _c.query(range, res);
                (_d = this.southWest) === null || _d === void 0 ? void 0 : _d.query(range, res);
            }
            return res;
        }
        subdivide() {
            const x = this.rectangle.position.x, y = this.rectangle.position.y, w = this.rectangle.size.width, h = this.rectangle.size.height, capacity = this.capacity;
            this.northEast = new QuadTree(new Rectangle(x, y, w / 2, h / 2), capacity);
            this.northWest = new QuadTree(new Rectangle(x + w / 2, y, w / 2, h / 2), capacity);
            this.southEast = new QuadTree(new Rectangle(x, y + h / 2, w / 2, h / 2), capacity);
            this.southWest = new QuadTree(new Rectangle(x + w / 2, y + h / 2, w / 2, h / 2), capacity);
            this.divided = true;
        }
    }

    var __classPrivateFieldSet$b = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$9 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Particles_engine;
    class Particles$1 {
        constructor(engine, container) {
            this.container = container;
            _Particles_engine.set(this, void 0);
            __classPrivateFieldSet$b(this, _Particles_engine, engine, "f");
            this.nextId = 0;
            this.array = [];
            this.zArray = [];
            this.limit = 0;
            this.needsSort = false;
            this.lastZIndex = 0;
            this.freqs = {
                links: new Map(),
                triangles: new Map(),
            };
            this.interactionManager = new InteractionManager(__classPrivateFieldGet$9(this, _Particles_engine, "f"), container);
            const canvasSize = this.container.canvas.size;
            this.linksColors = new Map();
            this.quadTree = new QuadTree(new Rectangle(-canvasSize.width / 4, -canvasSize.height / 4, (canvasSize.width * 3) / 2, (canvasSize.height * 3) / 2), 4);
            this.movers = __classPrivateFieldGet$9(this, _Particles_engine, "f").plugins.getMovers(container, true);
            this.updaters = __classPrivateFieldGet$9(this, _Particles_engine, "f").plugins.getUpdaters(container, true);
        }
        get count() {
            return this.array.length;
        }
        init() {
            var _a;
            const container = this.container, options = container.actualOptions;
            this.lastZIndex = 0;
            this.needsSort = false;
            this.freqs.links = new Map();
            this.freqs.triangles = new Map();
            let handled = false;
            this.updaters = __classPrivateFieldGet$9(this, _Particles_engine, "f").plugins.getUpdaters(container, true);
            this.interactionManager.init();
            for (const [, plugin] of container.plugins) {
                if (plugin.particlesInitialization !== undefined) {
                    handled = plugin.particlesInitialization();
                }
                if (handled) {
                    break;
                }
            }
            this.addManualParticles();
            if (!handled) {
                for (const group in options.particles.groups) {
                    const groupOptions = options.particles.groups[group];
                    for (let i = this.count, j = 0; j < ((_a = groupOptions.number) === null || _a === void 0 ? void 0 : _a.value) && i < options.particles.number.value; i++, j++) {
                        this.addParticle(undefined, groupOptions, group);
                    }
                }
                for (let i = this.count; i < options.particles.number.value; i++) {
                    this.addParticle();
                }
            }
            container.pathGenerator.init(container);
        }
        async redraw() {
            this.clear();
            this.init();
            await this.draw({ value: 0, factor: 0 });
        }
        removeAt(index, quantity = 1, group, override) {
            if (!(index >= 0 && index <= this.count)) {
                return;
            }
            let deleted = 0;
            for (let i = index; deleted < quantity && i < this.count; i++) {
                const particle = this.array[i];
                if (!particle || particle.group !== group) {
                    continue;
                }
                particle.destroy(override);
                this.array.splice(i--, 1);
                const zIdx = this.zArray.indexOf(particle);
                this.zArray.splice(zIdx, 1);
                deleted++;
                __classPrivateFieldGet$9(this, _Particles_engine, "f").dispatchEvent("particleRemoved", {
                    container: this.container,
                    data: {
                        particle,
                    },
                });
            }
        }
        remove(particle, group, override) {
            this.removeAt(this.array.indexOf(particle), undefined, group, override);
        }
        async update(delta) {
            const container = this.container, particlesToDelete = [];
            container.pathGenerator.update();
            for (const [, plugin] of container.plugins) {
                if (plugin.update !== undefined) {
                    plugin.update(delta);
                }
            }
            for (const particle of this.array) {
                const resizeFactor = container.canvas.resizeFactor;
                if (resizeFactor && !particle.ignoresResizeRatio) {
                    particle.position.x *= resizeFactor.width;
                    particle.position.y *= resizeFactor.height;
                }
                particle.ignoresResizeRatio = false;
                particle.bubble.inRange = false;
                for (const [, plugin] of this.container.plugins) {
                    if (particle.destroyed) {
                        break;
                    }
                    if (plugin.particleUpdate) {
                        plugin.particleUpdate(particle, delta);
                    }
                }
                for (const mover of this.movers) {
                    if (mover.isEnabled(particle)) {
                        mover.move(particle, delta);
                    }
                }
                if (particle.destroyed) {
                    particlesToDelete.push(particle);
                    continue;
                }
                this.quadTree.insert(new Point(particle.getPosition(), particle));
            }
            for (const particle of particlesToDelete) {
                this.remove(particle);
            }
            await this.interactionManager.externalInteract(delta);
            for (const particle of container.particles.array) {
                for (const updater of this.updaters) {
                    updater.update(particle, delta);
                }
                if (!particle.destroyed && !particle.spawning) {
                    await this.interactionManager.particlesInteract(particle, delta);
                }
            }
            delete container.canvas.resizeFactor;
        }
        async draw(delta) {
            const container = this.container, canvasSize = this.container.canvas.size;
            this.quadTree = new QuadTree(new Rectangle(-canvasSize.width / 4, -canvasSize.height / 4, (canvasSize.width * 3) / 2, (canvasSize.height * 3) / 2), 4);
            container.canvas.clear();
            await this.update(delta);
            if (this.needsSort) {
                this.zArray.sort((a, b) => b.position.z - a.position.z || a.id - b.id);
                this.lastZIndex = this.zArray[this.zArray.length - 1].position.z;
                this.needsSort = false;
            }
            for (const [, plugin] of container.plugins) {
                container.canvas.drawPlugin(plugin, delta);
            }
            for (const p of this.zArray) {
                p.draw(delta);
            }
        }
        clear() {
            this.array = [];
            this.zArray = [];
        }
        push(nb, mouse, overrideOptions, group) {
            this.pushing = true;
            for (let i = 0; i < nb; i++) {
                this.addParticle(mouse === null || mouse === void 0 ? void 0 : mouse.position, overrideOptions, group);
            }
            this.pushing = false;
        }
        addParticle(position, overrideOptions, group) {
            const container = this.container, options = container.actualOptions, limit = options.particles.number.limit * container.density;
            if (limit > 0) {
                const countToRemove = this.count + 1 - limit;
                if (countToRemove > 0) {
                    this.removeQuantity(countToRemove);
                }
            }
            return this.pushParticle(position, overrideOptions, group);
        }
        addSplitParticle(parent) {
            const splitOptions = parent.options.destroy.split;
            const options = loadParticlesOptions(parent.options);
            const factor = getValue(splitOptions.factor);
            options.color.load({
                value: {
                    hsl: parent.getFillColor(),
                },
            });
            if (typeof options.size.value === "number") {
                options.size.value /= factor;
            }
            else {
                options.size.value.min /= factor;
                options.size.value.max /= factor;
            }
            options.load(splitOptions.particles);
            const offset = splitOptions.sizeOffset ? setRangeValue(-parent.size.value, parent.size.value) : 0, position = {
                x: parent.position.x + randomInRange(offset),
                y: parent.position.y + randomInRange(offset),
            };
            return this.pushParticle(position, options, parent.group, (particle) => {
                if (particle.size.value < 0.5) {
                    return false;
                }
                particle.velocity.length = randomInRange(setRangeValue(parent.velocity.length, particle.velocity.length));
                particle.splitCount = parent.splitCount + 1;
                particle.unbreakable = true;
                setTimeout(() => {
                    particle.unbreakable = false;
                }, 500);
                return true;
            });
        }
        removeQuantity(quantity, group) {
            this.removeAt(0, quantity, group);
        }
        getLinkFrequency(p1, p2) {
            const range = setRangeValue(p1.id, p2.id), key = `${getRangeMin(range)}_${getRangeMax(range)}`;
            let res = this.freqs.links.get(key);
            if (res === undefined) {
                res = Math.random();
                this.freqs.links.set(key, res);
            }
            return res;
        }
        getTriangleFrequency(p1, p2, p3) {
            let [id1, id2, id3] = [p1.id, p2.id, p3.id];
            if (id1 > id2) {
                [id2, id1] = [id1, id2];
            }
            if (id2 > id3) {
                [id3, id2] = [id2, id3];
            }
            if (id1 > id3) {
                [id3, id1] = [id1, id3];
            }
            const key = `${id1}_${id2}_${id3}`;
            let res = this.freqs.triangles.get(key);
            if (res === undefined) {
                res = Math.random();
                this.freqs.triangles.set(key, res);
            }
            return res;
        }
        addManualParticles() {
            const container = this.container, options = container.actualOptions;
            for (const particle of options.manualParticles) {
                this.addParticle(calcPositionFromSize({
                    size: container.canvas.size,
                    position: particle.position,
                }), particle.options);
            }
        }
        setDensity() {
            const options = this.container.actualOptions;
            for (const group in options.particles.groups) {
                this.applyDensity(options.particles.groups[group], 0, group);
            }
            this.applyDensity(options.particles, options.manualParticles.length);
        }
        handleClickMode(mode) {
            this.interactionManager.handleClickMode(mode);
        }
        applyDensity(options, manualCount, group) {
            var _a;
            if (!((_a = options.number.density) === null || _a === void 0 ? void 0 : _a.enable)) {
                return;
            }
            const numberOptions = options.number, densityFactor = this.initDensityFactor(numberOptions.density), optParticlesNumber = numberOptions.value, optParticlesLimit = numberOptions.limit > 0 ? numberOptions.limit : optParticlesNumber, particlesNumber = Math.min(optParticlesNumber, optParticlesLimit) * densityFactor + manualCount, particlesCount = Math.min(this.count, this.array.filter((t) => t.group === group).length);
            this.limit = numberOptions.limit * densityFactor;
            if (particlesCount < particlesNumber) {
                this.push(Math.abs(particlesNumber - particlesCount), undefined, options, group);
            }
            else if (particlesCount > particlesNumber) {
                this.removeQuantity(particlesCount - particlesNumber, group);
            }
        }
        initDensityFactor(densityOptions) {
            const container = this.container;
            if (!container.canvas.element || !densityOptions.enable) {
                return 1;
            }
            const canvas = container.canvas.element, pxRatio = container.retina.pixelRatio;
            return (canvas.width * canvas.height) / (densityOptions.factor * pxRatio ** 2 * densityOptions.area);
        }
        pushParticle(position, overrideOptions, group, initializer) {
            try {
                const particle = new Particle(__classPrivateFieldGet$9(this, _Particles_engine, "f"), this.nextId, this.container, position, overrideOptions, group);
                let canAdd = true;
                if (initializer) {
                    canAdd = initializer(particle);
                }
                if (!canAdd) {
                    return;
                }
                this.array.push(particle);
                this.zArray.push(particle);
                this.nextId++;
                __classPrivateFieldGet$9(this, _Particles_engine, "f").dispatchEvent("particleAdded", {
                    container: this.container,
                    data: {
                        particle,
                    },
                });
                return particle;
            }
            catch (e) {
                console.warn(`error adding particle: ${e}`);
                return;
            }
        }
    }
    _Particles_engine = new WeakMap();

    class Retina {
        constructor(container) {
            this.container = container;
        }
        init() {
            const container = this.container, options = container.actualOptions;
            this.pixelRatio = !options.detectRetina || isSsr() ? 1 : window.devicePixelRatio;
            const motionOptions = this.container.actualOptions.motion;
            if (motionOptions && (motionOptions.disable || motionOptions.reduce.value)) {
                if (isSsr() || typeof matchMedia === "undefined" || !matchMedia) {
                    this.reduceFactor = 1;
                }
                else {
                    const mediaQuery = matchMedia("(prefers-reduced-motion: reduce)");
                    if (mediaQuery) {
                        this.handleMotionChange(mediaQuery);
                        const handleChange = () => {
                            this.handleMotionChange(mediaQuery);
                            container.refresh().catch(() => {
                            });
                        };
                        if (mediaQuery.addEventListener !== undefined) {
                            mediaQuery.addEventListener("change", handleChange);
                        }
                        else if (mediaQuery.addListener !== undefined) {
                            mediaQuery.addListener(handleChange);
                        }
                    }
                }
            }
            else {
                this.reduceFactor = 1;
            }
            const ratio = this.pixelRatio;
            if (container.canvas.element) {
                const element = container.canvas.element;
                container.canvas.size.width = element.offsetWidth * ratio;
                container.canvas.size.height = element.offsetHeight * ratio;
            }
            const particles = options.particles;
            this.attractDistance = getRangeValue(particles.move.attract.distance) * ratio;
            this.linksDistance = particles.links.distance * ratio;
            this.linksWidth = particles.links.width * ratio;
            this.sizeAnimationSpeed = getRangeValue(particles.size.animation.speed) * ratio;
            this.maxSpeed = getRangeValue(particles.move.gravity.maxSpeed) * ratio;
            const modes = options.interactivity.modes;
            this.connectModeDistance = modes.connect.distance * ratio;
            this.connectModeRadius = modes.connect.radius * ratio;
            this.grabModeDistance = modes.grab.distance * ratio;
            this.repulseModeDistance = modes.repulse.distance * ratio;
            this.bounceModeDistance = modes.bounce.distance * ratio;
            this.attractModeDistance = modes.attract.distance * ratio;
            this.slowModeRadius = modes.slow.radius * ratio;
            this.bubbleModeDistance = modes.bubble.distance * ratio;
            if (modes.bubble.size) {
                this.bubbleModeSize = modes.bubble.size * ratio;
            }
        }
        initParticle(particle) {
            const options = particle.options, ratio = this.pixelRatio, moveDistance = options.move.distance, props = particle.retina;
            props.attractDistance = getRangeValue(options.move.attract.distance) * ratio;
            props.linksDistance = options.links.distance * ratio;
            props.linksWidth = options.links.width * ratio;
            props.moveDrift = getRangeValue(options.move.drift) * ratio;
            props.moveSpeed = getRangeValue(options.move.speed) * ratio;
            props.sizeAnimationSpeed = getRangeValue(options.size.animation.speed) * ratio;
            const maxDistance = props.maxDistance;
            maxDistance.horizontal = moveDistance.horizontal !== undefined ? moveDistance.horizontal * ratio : undefined;
            maxDistance.vertical = moveDistance.vertical !== undefined ? moveDistance.vertical * ratio : undefined;
            props.maxSpeed = getRangeValue(options.move.gravity.maxSpeed) * ratio;
        }
        handleMotionChange(mediaQuery) {
            const options = this.container.actualOptions;
            if (mediaQuery.matches) {
                const motion = options.motion;
                this.reduceFactor = motion.disable ? 0 : motion.reduce.value ? 1 / motion.reduce.factor : 1;
            }
            else {
                this.reduceFactor = 1;
            }
        }
    }

    var __classPrivateFieldSet$a = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$8 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Container_engine;
    class Container {
        constructor(engine, id, sourceOptions) {
            this.id = id;
            _Container_engine.set(this, void 0);
            __classPrivateFieldSet$a(this, _Container_engine, engine, "f");
            this.fpsLimit = 120;
            this.duration = 0;
            this.lifeTime = 0;
            this.firstStart = true;
            this.started = false;
            this.destroyed = false;
            this.paused = true;
            this.lastFrameTime = 0;
            this.zLayers = 100;
            this.pageHidden = false;
            this._sourceOptions = sourceOptions;
            this._initialSourceOptions = sourceOptions;
            this.retina = new Retina(this);
            this.canvas = new Canvas(this);
            this.particles = new Particles$1(__classPrivateFieldGet$8(this, _Container_engine, "f"), this);
            this.drawer = new FrameManager(this);
            this.pathGenerator = {
                generate: (p) => {
                    const v = p.velocity.copy();
                    v.angle += (v.length * Math.PI) / 180;
                    return v;
                },
                init: () => {
                },
                update: () => {
                },
            };
            this.interactivity = {
                mouse: {
                    clicking: false,
                    inside: false,
                },
            };
            this.plugins = new Map();
            this.drawers = new Map();
            this.density = 1;
            this._options = loadContainerOptions(__classPrivateFieldGet$8(this, _Container_engine, "f"));
            this.actualOptions = loadContainerOptions(__classPrivateFieldGet$8(this, _Container_engine, "f"));
            this.eventListeners = new EventListeners(this);
            if (typeof IntersectionObserver !== "undefined" && IntersectionObserver) {
                this.intersectionObserver = new IntersectionObserver((entries) => this.intersectionManager(entries));
            }
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("containerBuilt", { container: this });
        }
        get options() {
            return this._options;
        }
        get sourceOptions() {
            return this._sourceOptions;
        }
        play(force) {
            const needsUpdate = this.paused || force;
            if (this.firstStart && !this.actualOptions.autoPlay) {
                this.firstStart = false;
                return;
            }
            if (this.paused) {
                this.paused = false;
            }
            if (needsUpdate) {
                for (const [, plugin] of this.plugins) {
                    if (plugin.play) {
                        plugin.play();
                    }
                }
            }
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("containerPlay", { container: this });
            this.draw(needsUpdate || false);
        }
        pause() {
            if (this.drawAnimationFrame !== undefined) {
                cancelAnimation()(this.drawAnimationFrame);
                delete this.drawAnimationFrame;
            }
            if (this.paused) {
                return;
            }
            for (const [, plugin] of this.plugins) {
                if (plugin.pause) {
                    plugin.pause();
                }
            }
            if (!this.pageHidden) {
                this.paused = true;
            }
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("containerPaused", { container: this });
        }
        draw(force) {
            let refreshTime = force;
            this.drawAnimationFrame = animate()(async (timestamp) => {
                if (refreshTime) {
                    this.lastFrameTime = undefined;
                    refreshTime = false;
                }
                await this.drawer.nextFrame(timestamp);
            });
        }
        getAnimationStatus() {
            return !this.paused && !this.pageHidden;
        }
        setNoise(noiseOrGenerator, init, update) {
            this.setPath(noiseOrGenerator, init, update);
        }
        setPath(pathOrGenerator, init, update) {
            var _a, _b, _c;
            if (!pathOrGenerator) {
                return;
            }
            if (typeof pathOrGenerator === "function") {
                this.pathGenerator.generate = pathOrGenerator;
                if (init) {
                    this.pathGenerator.init = init;
                }
                if (update) {
                    this.pathGenerator.update = update;
                }
            }
            else {
                const oldGenerator = this.pathGenerator;
                this.pathGenerator = pathOrGenerator;
                (_a = this.pathGenerator).generate || (_a.generate = oldGenerator.generate);
                (_b = this.pathGenerator).init || (_b.init = oldGenerator.init);
                (_c = this.pathGenerator).update || (_c.update = oldGenerator.update);
            }
        }
        destroy() {
            this.stop();
            this.canvas.destroy();
            for (const [, drawer] of this.drawers) {
                if (drawer.destroy) {
                    drawer.destroy(this);
                }
            }
            for (const key of this.drawers.keys()) {
                this.drawers.delete(key);
            }
            this.destroyed = true;
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("containerDestroyed", { container: this });
        }
        exportImg(callback) {
            this.exportImage(callback);
        }
        exportImage(callback, type, quality) {
            var _a;
            return (_a = this.canvas.element) === null || _a === void 0 ? void 0 : _a.toBlob(callback, type !== null && type !== void 0 ? type : "image/png", quality);
        }
        exportConfiguration() {
            return JSON.stringify(this.actualOptions, undefined, 2);
        }
        refresh() {
            this.stop();
            return this.start();
        }
        reset() {
            this._options = loadContainerOptions(__classPrivateFieldGet$8(this, _Container_engine, "f"));
            return this.refresh();
        }
        stop() {
            if (!this.started) {
                return;
            }
            this.firstStart = true;
            this.started = false;
            this.eventListeners.removeListeners();
            this.pause();
            this.particles.clear();
            this.canvas.clear();
            if (this.interactivity.element instanceof HTMLElement && this.intersectionObserver) {
                this.intersectionObserver.unobserve(this.interactivity.element);
            }
            for (const [, plugin] of this.plugins) {
                if (plugin.stop) {
                    plugin.stop();
                }
            }
            for (const key of this.plugins.keys()) {
                this.plugins.delete(key);
            }
            this.particles.linksColors = new Map();
            delete this.particles.grabLineColor;
            delete this.particles.linksColor;
            this._sourceOptions = this._options;
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("containerStopped", { container: this });
        }
        async loadTheme(name) {
            this.currentTheme = name;
            await this.refresh();
        }
        async start() {
            if (this.started) {
                return;
            }
            await this.init();
            this.started = true;
            this.eventListeners.addListeners();
            if (this.interactivity.element instanceof HTMLElement && this.intersectionObserver) {
                this.intersectionObserver.observe(this.interactivity.element);
            }
            for (const [, plugin] of this.plugins) {
                if (plugin.startAsync !== undefined) {
                    await plugin.startAsync();
                }
                else if (plugin.start !== undefined) {
                    plugin.start();
                }
            }
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("containerStarted", { container: this });
            this.play();
        }
        addClickHandler(callback) {
            const el = this.interactivity.element;
            if (!el) {
                return;
            }
            const clickOrTouchHandler = (e, pos, radius) => {
                if (this.destroyed) {
                    return;
                }
                const pxRatio = this.retina.pixelRatio, posRetina = {
                    x: pos.x * pxRatio,
                    y: pos.y * pxRatio,
                }, particles = this.particles.quadTree.queryCircle(posRetina, radius * pxRatio);
                callback(e, particles);
            };
            const clickHandler = (e) => {
                if (this.destroyed) {
                    return;
                }
                const mouseEvent = e, pos = {
                    x: mouseEvent.offsetX || mouseEvent.clientX,
                    y: mouseEvent.offsetY || mouseEvent.clientY,
                };
                clickOrTouchHandler(e, pos, 1);
            };
            const touchStartHandler = () => {
                if (this.destroyed) {
                    return;
                }
                touched = true;
                touchMoved = false;
            };
            const touchMoveHandler = () => {
                if (this.destroyed) {
                    return;
                }
                touchMoved = true;
            };
            const touchEndHandler = (e) => {
                var _a, _b, _c;
                if (this.destroyed) {
                    return;
                }
                if (touched && !touchMoved) {
                    const touchEvent = e;
                    let lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
                    if (!lastTouch) {
                        lastTouch = touchEvent.changedTouches[touchEvent.changedTouches.length - 1];
                        if (!lastTouch) {
                            return;
                        }
                    }
                    const canvasRect = (_a = this.canvas.element) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect(), pos = {
                        x: lastTouch.clientX - ((_b = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.left) !== null && _b !== void 0 ? _b : 0),
                        y: lastTouch.clientY - ((_c = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.top) !== null && _c !== void 0 ? _c : 0),
                    };
                    clickOrTouchHandler(e, pos, Math.max(lastTouch.radiusX, lastTouch.radiusY));
                }
                touched = false;
                touchMoved = false;
            };
            const touchCancelHandler = () => {
                if (this.destroyed) {
                    return;
                }
                touched = false;
                touchMoved = false;
            };
            let touched = false;
            let touchMoved = false;
            el.addEventListener("click", clickHandler);
            el.addEventListener("touchstart", touchStartHandler);
            el.addEventListener("touchmove", touchMoveHandler);
            el.addEventListener("touchend", touchEndHandler);
            el.addEventListener("touchcancel", touchCancelHandler);
        }
        handleClickMode(mode) {
            this.particles.handleClickMode(mode);
            for (const [, plugin] of this.plugins) {
                if (plugin.handleClickMode) {
                    plugin.handleClickMode(mode);
                }
            }
        }
        updateActualOptions() {
            this.actualOptions.responsive = [];
            const newMaxWidth = this.actualOptions.setResponsive(this.canvas.size.width, this.retina.pixelRatio, this._options);
            this.actualOptions.setTheme(this.currentTheme);
            if (this.responsiveMaxWidth != newMaxWidth) {
                this.responsiveMaxWidth = newMaxWidth;
                return true;
            }
            return false;
        }
        async init() {
            const shapes = __classPrivateFieldGet$8(this, _Container_engine, "f").plugins.getSupportedShapes();
            for (const type of shapes) {
                const drawer = __classPrivateFieldGet$8(this, _Container_engine, "f").plugins.getShapeDrawer(type);
                if (drawer) {
                    this.drawers.set(type, drawer);
                }
            }
            this._options = loadContainerOptions(__classPrivateFieldGet$8(this, _Container_engine, "f"), this._initialSourceOptions, this.sourceOptions);
            this.actualOptions = loadContainerOptions(__classPrivateFieldGet$8(this, _Container_engine, "f"), this._options);
            this.retina.init();
            this.canvas.init();
            this.updateActualOptions();
            this.canvas.initBackground();
            this.canvas.resize();
            this.zLayers = this.actualOptions.zLayers;
            this.duration = getRangeValue(this.actualOptions.duration);
            this.lifeTime = 0;
            this.fpsLimit = this.actualOptions.fpsLimit > 0 ? this.actualOptions.fpsLimit : 120;
            const availablePlugins = __classPrivateFieldGet$8(this, _Container_engine, "f").plugins.getAvailablePlugins(this);
            for (const [id, plugin] of availablePlugins) {
                this.plugins.set(id, plugin);
            }
            for (const [, drawer] of this.drawers) {
                if (drawer.init) {
                    await drawer.init(this);
                }
            }
            for (const [, plugin] of this.plugins) {
                if (plugin.init) {
                    plugin.init(this.actualOptions);
                }
                else if (plugin.initAsync !== undefined) {
                    await plugin.initAsync(this.actualOptions);
                }
            }
            const pathOptions = this.actualOptions.particles.move.path;
            if (pathOptions.generator) {
                this.setPath(__classPrivateFieldGet$8(this, _Container_engine, "f").plugins.getPathGenerator(pathOptions.generator));
            }
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("containerInit", { container: this });
            this.particles.init();
            this.particles.setDensity();
            for (const [, plugin] of this.plugins) {
                if (plugin.particlesSetup !== undefined) {
                    plugin.particlesSetup();
                }
            }
            __classPrivateFieldGet$8(this, _Container_engine, "f").dispatchEvent("particlesSetup", { container: this });
        }
        intersectionManager(entries) {
            if (!this.actualOptions.pauseOnOutsideViewport) {
                return;
            }
            for (const entry of entries) {
                if (entry.target !== this.interactivity.element) {
                    continue;
                }
                if (entry.isIntersecting) {
                    this.play();
                }
                else {
                    this.pause();
                }
            }
        }
    }
    _Container_engine = new WeakMap();

    var __classPrivateFieldSet$9 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$7 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Loader_engine;
    function fetchError(statusCode) {
        console.error(`Error tsParticles - fetch status: ${statusCode}`);
        console.error("Error tsParticles - File config not found");
    }
    class Loader {
        constructor(engine) {
            _Loader_engine.set(this, void 0);
            __classPrivateFieldSet$9(this, _Loader_engine, engine, "f");
        }
        dom() {
            return __classPrivateFieldGet$7(this, _Loader_engine, "f").domArray;
        }
        domItem(index) {
            const dom = this.dom();
            const item = dom[index];
            if (item && !item.destroyed) {
                return item;
            }
            dom.splice(index, 1);
        }
        async loadOptions(params) {
            var _a, _b, _c;
            const tagId = (_a = params.tagId) !== null && _a !== void 0 ? _a : `tsparticles${Math.floor(Math.random() * 10000)}`, { options, index } = params;
            let domContainer = (_b = params.element) !== null && _b !== void 0 ? _b : document.getElementById(tagId);
            if (!domContainer) {
                domContainer = document.createElement("div");
                domContainer.id = tagId;
                (_c = document.querySelector("body")) === null || _c === void 0 ? void 0 : _c.append(domContainer);
            }
            const currentOptions = options instanceof Array ? itemFromArray(options, index) : options, dom = this.dom(), oldIndex = dom.findIndex((v) => v.id === tagId);
            if (oldIndex >= 0) {
                const old = this.domItem(oldIndex);
                if (old && !old.destroyed) {
                    old.destroy();
                    dom.splice(oldIndex, 1);
                }
            }
            let canvasEl;
            if (domContainer.tagName.toLowerCase() === "canvas") {
                canvasEl = domContainer;
                canvasEl.dataset[generatedAttribute] = "false";
            }
            else {
                const existingCanvases = domContainer.getElementsByTagName("canvas");
                if (existingCanvases.length) {
                    canvasEl = existingCanvases[0];
                    canvasEl.dataset[generatedAttribute] = "false";
                }
                else {
                    canvasEl = document.createElement("canvas");
                    canvasEl.dataset[generatedAttribute] = "true";
                    canvasEl.style.width = "100%";
                    canvasEl.style.height = "100%";
                    domContainer.appendChild(canvasEl);
                }
            }
            const newItem = new Container(__classPrivateFieldGet$7(this, _Loader_engine, "f"), tagId, currentOptions);
            if (oldIndex >= 0) {
                dom.splice(oldIndex, 0, newItem);
            }
            else {
                dom.push(newItem);
            }
            newItem.canvas.loadCanvas(canvasEl);
            await newItem.start();
            return newItem;
        }
        async loadRemoteOptions(params) {
            const { url: jsonUrl, index } = params, url = jsonUrl instanceof Array ? itemFromArray(jsonUrl, index) : jsonUrl;
            if (!url) {
                return;
            }
            const response = await fetch(url);
            if (!response.ok) {
                fetchError(response.status);
                return;
            }
            const data = await response.json();
            return this.loadOptions({
                tagId: params.tagId,
                element: params.element,
                index,
                options: data,
            });
        }
        load(tagId, options, index) {
            const params = { index };
            if (typeof tagId === "string") {
                params.tagId = tagId;
            }
            else {
                params.options = tagId;
            }
            if (typeof options === "number") {
                params.index = options !== null && options !== void 0 ? options : params.index;
            }
            else {
                params.options = options !== null && options !== void 0 ? options : params.options;
            }
            return this.loadOptions(params);
        }
        async set(id, domContainer, options, index) {
            const params = { index };
            if (typeof id === "string") {
                params.tagId = id;
            }
            else {
                params.element = id;
            }
            if (domContainer instanceof HTMLElement) {
                params.element = domContainer;
            }
            else {
                params.options = domContainer;
            }
            if (typeof options === "number") {
                params.index = options;
            }
            else {
                params.options = options !== null && options !== void 0 ? options : params.options;
            }
            return this.loadOptions(params);
        }
        async loadJSON(tagId, jsonUrl, index) {
            let url, id;
            if (typeof jsonUrl === "number" || jsonUrl === undefined) {
                url = tagId;
            }
            else {
                id = tagId;
                url = jsonUrl;
            }
            return this.loadRemoteOptions({ tagId: id, url, index });
        }
        async setJSON(id, domContainer, jsonUrl, index) {
            let url, newId, newIndex, element;
            if (id instanceof HTMLElement) {
                element = id;
                url = domContainer;
                newIndex = jsonUrl;
            }
            else {
                newId = id;
                element = domContainer;
                url = jsonUrl;
                newIndex = index;
            }
            return this.loadRemoteOptions({ tagId: newId, url, index: newIndex, element });
        }
        setOnClickHandler(callback) {
            const dom = this.dom();
            if (!dom.length) {
                throw new Error("Can only set click handlers after calling tsParticles.load() or tsParticles.loadJSON()");
            }
            for (const domItem of dom) {
                domItem.addClickHandler(callback);
            }
        }
        addEventListener(type, listener) {
            __classPrivateFieldGet$7(this, _Loader_engine, "f").eventDispatcher.addEventListener(type, listener);
        }
        removeEventListener(type, listener) {
            __classPrivateFieldGet$7(this, _Loader_engine, "f").eventDispatcher.removeEventListener(type, listener);
        }
        dispatchEvent(type, args) {
            __classPrivateFieldGet$7(this, _Loader_engine, "f").eventDispatcher.dispatchEvent(type, args);
        }
    }
    _Loader_engine = new WeakMap();

    var __classPrivateFieldSet$8 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var _Plugins_engine;
    class Plugins {
        constructor(engine) {
            _Plugins_engine.set(this, void 0);
            __classPrivateFieldSet$8(this, _Plugins_engine, engine, "f");
            this.plugins = [];
            this.interactorsInitializers = new Map();
            this.moversInitializers = new Map();
            this.updatersInitializers = new Map();
            this.interactors = new Map();
            this.movers = new Map();
            this.updaters = new Map();
            this.presets = new Map();
            this.drawers = new Map();
            this.pathGenerators = new Map();
        }
        getPlugin(plugin) {
            return this.plugins.find((t) => t.id === plugin);
        }
        addPlugin(plugin) {
            if (!this.getPlugin(plugin.id)) {
                this.plugins.push(plugin);
            }
        }
        getAvailablePlugins(container) {
            const res = new Map();
            for (const plugin of this.plugins) {
                if (!plugin.needsPlugin(container.actualOptions)) {
                    continue;
                }
                res.set(plugin.id, plugin.getPlugin(container));
            }
            return res;
        }
        loadOptions(options, sourceOptions) {
            for (const plugin of this.plugins) {
                plugin.loadOptions(options, sourceOptions);
            }
        }
        getPreset(preset) {
            return this.presets.get(preset);
        }
        addPreset(presetKey, options, override = false) {
            if (override || !this.getPreset(presetKey)) {
                this.presets.set(presetKey, options);
            }
        }
        getShapeDrawer(type) {
            return this.drawers.get(type);
        }
        addShapeDrawer(type, drawer) {
            if (!this.getShapeDrawer(type)) {
                this.drawers.set(type, drawer);
            }
        }
        getSupportedShapes() {
            return this.drawers.keys();
        }
        getPathGenerator(type) {
            return this.pathGenerators.get(type);
        }
        addPathGenerator(type, pathGenerator) {
            if (!this.getPathGenerator(type)) {
                this.pathGenerators.set(type, pathGenerator);
            }
        }
        getInteractors(container, force = false) {
            let res = this.interactors.get(container);
            if (!res || force) {
                res = [...this.interactorsInitializers.values()].map((t) => t(container));
                this.interactors.set(container, res);
            }
            return res;
        }
        addInteractor(name, initInteractor) {
            this.interactorsInitializers.set(name, initInteractor);
        }
        getUpdaters(container, force = false) {
            let res = this.updaters.get(container);
            if (!res || force) {
                res = [...this.updatersInitializers.values()].map((t) => t(container));
                this.updaters.set(container, res);
            }
            return res;
        }
        addParticleUpdater(name, initUpdater) {
            this.updatersInitializers.set(name, initUpdater);
        }
        getMovers(container, force = false) {
            let res = this.movers.get(container);
            if (!res || force) {
                res = [...this.moversInitializers.values()].map((t) => t(container));
                this.movers.set(container, res);
            }
            return res;
        }
        addParticleMover(name, initMover) {
            this.moversInitializers.set(name, initMover);
        }
    }
    _Plugins_engine = new WeakMap();

    var __classPrivateFieldSet$7 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$6 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Engine_initialized, _Engine_loader;
    class Engine {
        constructor() {
            _Engine_initialized.set(this, void 0);
            _Engine_loader.set(this, void 0);
            this.domArray = [];
            this.eventDispatcher = new EventDispatcher();
            __classPrivateFieldSet$7(this, _Engine_initialized, false, "f");
            __classPrivateFieldSet$7(this, _Engine_loader, new Loader(this), "f");
            this.plugins = new Plugins(this);
        }
        init() {
            if (!__classPrivateFieldGet$6(this, _Engine_initialized, "f")) {
                __classPrivateFieldSet$7(this, _Engine_initialized, true, "f");
            }
        }
        async loadFromArray(tagId, options, index) {
            return __classPrivateFieldGet$6(this, _Engine_loader, "f").load(tagId, options, index);
        }
        async load(tagId, options) {
            return __classPrivateFieldGet$6(this, _Engine_loader, "f").load(tagId, options);
        }
        async set(id, element, options) {
            return __classPrivateFieldGet$6(this, _Engine_loader, "f").set(id, element, options);
        }
        async loadJSON(tagId, pathConfigJson, index) {
            return __classPrivateFieldGet$6(this, _Engine_loader, "f").loadJSON(tagId, pathConfigJson, index);
        }
        async setJSON(id, element, pathConfigJson, index) {
            return __classPrivateFieldGet$6(this, _Engine_loader, "f").setJSON(id, element, pathConfigJson, index);
        }
        setOnClickHandler(callback) {
            __classPrivateFieldGet$6(this, _Engine_loader, "f").setOnClickHandler(callback);
        }
        dom() {
            return __classPrivateFieldGet$6(this, _Engine_loader, "f").dom();
        }
        domItem(index) {
            return __classPrivateFieldGet$6(this, _Engine_loader, "f").domItem(index);
        }
        async refresh() {
            for (const instance of this.dom()) {
                await instance.refresh();
            }
        }
        async addShape(shape, drawer, init, afterEffect, destroy) {
            let customDrawer;
            if (typeof drawer === "function") {
                customDrawer = {
                    afterEffect: afterEffect,
                    destroy: destroy,
                    draw: drawer,
                    init: init,
                };
            }
            else {
                customDrawer = drawer;
            }
            this.plugins.addShapeDrawer(shape, customDrawer);
            await this.refresh();
        }
        async addPreset(preset, options, override = false) {
            this.plugins.addPreset(preset, options, override);
            await this.refresh();
        }
        async addPlugin(plugin) {
            this.plugins.addPlugin(plugin);
            await this.refresh();
        }
        async addPathGenerator(name, generator) {
            this.plugins.addPathGenerator(name, generator);
            await this.refresh();
        }
        async addInteractor(name, interactorInitializer) {
            this.plugins.addInteractor(name, interactorInitializer);
            await this.refresh();
        }
        async addMover(name, moverInitializer) {
            this.plugins.addParticleMover(name, moverInitializer);
            await this.refresh();
        }
        async addParticleUpdater(name, updaterInitializer) {
            this.plugins.addParticleUpdater(name, updaterInitializer);
            await this.refresh();
        }
        addEventListener(type, listener) {
            __classPrivateFieldGet$6(this, _Engine_loader, "f").addEventListener(type, listener);
        }
        removeEventListener(type, listener) {
            __classPrivateFieldGet$6(this, _Engine_loader, "f").removeEventListener(type, listener);
        }
        dispatchEvent(type, args) {
            __classPrivateFieldGet$6(this, _Engine_loader, "f").dispatchEvent(type, args);
        }
    }
    _Engine_initialized = new WeakMap(), _Engine_loader = new WeakMap();

    class ExternalInteractorBase {
        constructor(container) {
            this.container = container;
            this.type = 0;
        }
    }

    class ParticlesInteractorBase {
        constructor(container) {
            this.container = container;
            this.type = 1;
        }
    }

    const tsParticles = new Engine();
    tsParticles.init();

    /* node_modules/svelte-particles/src/Particles.svelte generated by Svelte v3.45.0 */

    const { console: console_1$1 } = globals;
    const file$1 = "node_modules/svelte-particles/src/Particles.svelte";

    function create_fragment$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "id", /*id*/ ctx[0]);
    			add_location(div, file$1, 50, 0, 1341);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*id*/ 1) {
    				attr_dev(div, "id", /*id*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const particlesLoadedEvent = "particlesLoaded";

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Particles', slots, []);
    	let { options = {} } = $$props;
    	let { url = "" } = $$props;
    	let { id = "tsparticles" } = $$props;
    	let { particlesInit } = $$props;
    	const dispatch = createEventDispatcher();
    	let oldId = id;

    	afterUpdate(async () => {
    		tsParticles.init();

    		if (particlesInit) {
    			await particlesInit(tsParticles);
    		}

    		if (oldId) {
    			const oldContainer = tsParticles.dom().find(c => c.id === oldId);

    			if (oldContainer) {
    				oldContainer.destroy();
    			}
    		}

    		if (id) {
    			const cb = container => {
    				dispatch(particlesLoadedEvent, { particles: container });
    				oldId = id;
    			};

    			let container;

    			if (url) {
    				container = await tsParticles.loadJSON(id, url);
    			} else if (options) {
    				container = await tsParticles.load(id, options);
    			} else {
    				console.error("You must specify options or url to load tsParticles");
    				return;
    			}

    			cb(container);
    		} else {
    			dispatch(particlesLoadedEvent, { particles: undefined });
    		}
    	});

    	const writable_props = ['options', 'url', 'id', 'particlesInit'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Particles> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('options' in $$props) $$invalidate(1, options = $$props.options);
    		if ('url' in $$props) $$invalidate(2, url = $$props.url);
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('particlesInit' in $$props) $$invalidate(3, particlesInit = $$props.particlesInit);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		createEventDispatcher,
    		tsParticles,
    		options,
    		url,
    		id,
    		particlesInit,
    		dispatch,
    		particlesLoadedEvent,
    		oldId
    	});

    	$$self.$inject_state = $$props => {
    		if ('options' in $$props) $$invalidate(1, options = $$props.options);
    		if ('url' in $$props) $$invalidate(2, url = $$props.url);
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('particlesInit' in $$props) $$invalidate(3, particlesInit = $$props.particlesInit);
    		if ('oldId' in $$props) oldId = $$props.oldId;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, options, url, particlesInit];
    }

    class Particles extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			options: 1,
    			url: 2,
    			id: 0,
    			particlesInit: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Particles",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*particlesInit*/ ctx[3] === undefined && !('particlesInit' in props)) {
    			console_1$1.warn("<Particles> was created without expected prop 'particlesInit'");
    		}
    	}

    	get options() {
    		return this.$$.ctx[1];
    	}

    	set options(options) {
    		this.$$set({ options });
    		flush();
    	}

    	get url() {
    		return this.$$.ctx[2];
    	}

    	set url(url) {
    		this.$$set({ url });
    		flush();
    	}

    	get id() {
    		return this.$$.ctx[0];
    	}

    	set id(id) {
    		this.$$set({ id });
    		flush();
    	}

    	get particlesInit() {
    		return this.$$.ctx[3];
    	}

    	set particlesInit(particlesInit) {
    		this.$$set({ particlesInit });
    		flush();
    	}
    }

    class AbsorberSizeLimit {
        constructor() {
            this.radius = 0;
            this.mass = 0;
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.mass !== undefined) {
                this.mass = data.mass;
            }
            if (data.radius !== undefined) {
                this.radius = data.radius;
            }
        }
    }

    class AbsorberSize extends ValueWithRandom {
        constructor() {
            super();
            this.density = 5;
            this.value = 50;
            this.limit = new AbsorberSizeLimit();
        }
        load(data) {
            if (!data) {
                return;
            }
            super.load(data);
            if (data.density !== undefined) {
                this.density = data.density;
            }
            if (typeof data.limit === "number") {
                this.limit.radius = data.limit;
            }
            else {
                this.limit.load(data.limit);
            }
        }
    }

    class Absorber {
        constructor() {
            this.color = new OptionsColor();
            this.color.value = "#000000";
            this.draggable = false;
            this.opacity = 1;
            this.destroy = true;
            this.orbits = false;
            this.size = new AbsorberSize();
        }
        load(data) {
            if (data === undefined) {
                return;
            }
            if (data.color !== undefined) {
                this.color = OptionsColor.create(this.color, data.color);
            }
            if (data.draggable !== undefined) {
                this.draggable = data.draggable;
            }
            this.name = data.name;
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
            if (data.position !== undefined) {
                this.position = {};
                if (data.position.x !== undefined) {
                    this.position.x = setRangeValue(data.position.x);
                }
                if (data.position.y !== undefined) {
                    this.position.y = setRangeValue(data.position.y);
                }
            }
            if (data.size !== undefined) {
                this.size.load(data.size);
            }
            if (data.destroy !== undefined) {
                this.destroy = data.destroy;
            }
            if (data.orbits !== undefined) {
                this.orbits = data.orbits;
            }
        }
    }

    class AbsorberInstance {
        constructor(absorbers, container, options, position) {
            var _a, _b, _c;
            this.absorbers = absorbers;
            this.container = container;
            this.initialPosition = position ? Vector.create(position.x, position.y) : undefined;
            if (options instanceof Absorber) {
                this.options = options;
            }
            else {
                this.options = new Absorber();
                this.options.load(options);
            }
            this.dragging = false;
            this.name = this.options.name;
            this.opacity = this.options.opacity;
            this.size = getRangeValue(this.options.size.value) * container.retina.pixelRatio;
            this.mass = this.size * this.options.size.density * container.retina.reduceFactor;
            const limit = this.options.size.limit;
            this.limit = {
                radius: limit.radius * container.retina.pixelRatio * container.retina.reduceFactor,
                mass: limit.mass,
            };
            this.color = (_a = colorToRgb(this.options.color)) !== null && _a !== void 0 ? _a : {
                b: 0,
                g: 0,
                r: 0,
            };
            this.position = (_c = (_b = this.initialPosition) === null || _b === void 0 ? void 0 : _b.copy()) !== null && _c !== void 0 ? _c : this.calcPosition();
        }
        attract(particle) {
            const container = this.container, options = this.options;
            if (options.draggable) {
                const mouse = container.interactivity.mouse;
                if (mouse.clicking && mouse.downPosition) {
                    const mouseDist = getDistance(this.position, mouse.downPosition);
                    if (mouseDist <= this.size) {
                        this.dragging = true;
                    }
                }
                else {
                    this.dragging = false;
                }
                if (this.dragging && mouse.position) {
                    this.position.x = mouse.position.x;
                    this.position.y = mouse.position.y;
                }
            }
            const pos = particle.getPosition(), { dx, dy, distance } = getDistances(this.position, pos), v = Vector.create(dx, dy);
            v.length = (this.mass / Math.pow(distance, 2)) * container.retina.reduceFactor;
            if (distance < this.size + particle.getRadius()) {
                const sizeFactor = particle.getRadius() * 0.033 * container.retina.pixelRatio;
                if ((this.size > particle.getRadius() && distance < this.size - particle.getRadius()) ||
                    (particle.absorberOrbit !== undefined && particle.absorberOrbit.length < 0)) {
                    if (options.destroy) {
                        particle.destroy();
                    }
                    else {
                        particle.needsNewPosition = true;
                        this.updateParticlePosition(particle, v);
                    }
                }
                else {
                    if (options.destroy) {
                        particle.size.value -= sizeFactor;
                    }
                    this.updateParticlePosition(particle, v);
                }
                if (this.limit.radius <= 0 || this.size < this.limit.radius) {
                    this.size += sizeFactor;
                }
                if (this.limit.mass <= 0 || this.mass < this.limit.mass) {
                    this.mass += sizeFactor * this.options.size.density * container.retina.reduceFactor;
                }
            }
            else {
                this.updateParticlePosition(particle, v);
            }
        }
        resize() {
            const initialPosition = this.initialPosition;
            this.position =
                initialPosition && isPointInside(initialPosition, this.container.canvas.size, Vector.origin)
                    ? initialPosition
                    : this.calcPosition();
        }
        draw(context) {
            context.translate(this.position.x, this.position.y);
            context.beginPath();
            context.arc(0, 0, this.size, 0, Math.PI * 2, false);
            context.closePath();
            context.fillStyle = getStyleFromRgb(this.color, this.opacity);
            context.fill();
        }
        calcPosition() {
            const exactPosition = calcPositionOrRandomFromSizeRanged({
                size: this.container.canvas.size,
                position: this.options.position,
            });
            return Vector.create(exactPosition.x, exactPosition.y);
        }
        updateParticlePosition(particle, v) {
            var _a;
            if (particle.destroyed) {
                return;
            }
            const container = this.container, canvasSize = container.canvas.size;
            if (particle.needsNewPosition) {
                const newPosition = calcPositionOrRandomFromSize({ size: canvasSize });
                particle.position.setTo(newPosition);
                particle.velocity.setTo(particle.initialVelocity);
                particle.absorberOrbit = undefined;
                particle.needsNewPosition = false;
            }
            if (this.options.orbits) {
                if (particle.absorberOrbit === undefined) {
                    particle.absorberOrbit = Vector.create(0, 0);
                    particle.absorberOrbit.length = getDistance(particle.getPosition(), this.position);
                    particle.absorberOrbit.angle = Math.random() * Math.PI * 2;
                }
                if (particle.absorberOrbit.length <= this.size && !this.options.destroy) {
                    const minSize = Math.min(canvasSize.width, canvasSize.height);
                    particle.absorberOrbit.length = minSize * (1 + (Math.random() * 0.2 - 0.1));
                }
                if (particle.absorberOrbitDirection === undefined) {
                    particle.absorberOrbitDirection =
                        particle.velocity.x >= 0 ? "clockwise" : "counter-clockwise";
                }
                const orbitRadius = particle.absorberOrbit.length, orbitAngle = particle.absorberOrbit.angle, orbitDirection = particle.absorberOrbitDirection;
                particle.velocity.setTo(Vector.origin);
                const updateFunc = {
                    x: orbitDirection === "clockwise" ? Math.cos : Math.sin,
                    y: orbitDirection === "clockwise" ? Math.sin : Math.cos,
                };
                particle.position.x = this.position.x + orbitRadius * updateFunc.x(orbitAngle);
                particle.position.y = this.position.y + orbitRadius * updateFunc.y(orbitAngle);
                particle.absorberOrbit.length -= v.length;
                particle.absorberOrbit.angle +=
                    ((((_a = particle.retina.moveSpeed) !== null && _a !== void 0 ? _a : 0) * container.retina.pixelRatio) / 100) *
                        container.retina.reduceFactor;
            }
            else {
                const addV = Vector.origin;
                addV.length = v.length;
                addV.angle = v.angle;
                particle.velocity.addTo(addV);
            }
        }
    }

    class Absorbers {
        constructor(container) {
            this.container = container;
            this.array = [];
            this.absorbers = [];
            this.interactivityAbsorbers = [];
            container.getAbsorber = (idxOrName) => idxOrName === undefined || typeof idxOrName === "number"
                ? this.array[idxOrName || 0]
                : this.array.find((t) => t.name === idxOrName);
            container.addAbsorber = (options, position) => this.addAbsorber(options, position);
        }
        init(options) {
            var _a, _b;
            if (!options) {
                return;
            }
            if (options.absorbers) {
                if (options.absorbers instanceof Array) {
                    this.absorbers = options.absorbers.map((s) => {
                        const tmp = new Absorber();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    if (this.absorbers instanceof Array) {
                        this.absorbers = new Absorber();
                    }
                    this.absorbers.load(options.absorbers);
                }
            }
            const interactivityAbsorbers = (_b = (_a = options.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.absorbers;
            if (interactivityAbsorbers) {
                if (interactivityAbsorbers instanceof Array) {
                    this.interactivityAbsorbers = interactivityAbsorbers.map((s) => {
                        const tmp = new Absorber();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    if (this.interactivityAbsorbers instanceof Array) {
                        this.interactivityAbsorbers = new Absorber();
                    }
                    this.interactivityAbsorbers.load(interactivityAbsorbers);
                }
            }
            if (this.absorbers instanceof Array) {
                for (const absorberOptions of this.absorbers) {
                    this.addAbsorber(absorberOptions);
                }
            }
            else {
                this.addAbsorber(this.absorbers);
            }
        }
        particleUpdate(particle) {
            for (const absorber of this.array) {
                absorber.attract(particle);
                if (particle.destroyed) {
                    break;
                }
            }
        }
        draw(context) {
            for (const absorber of this.array) {
                context.save();
                absorber.draw(context);
                context.restore();
            }
        }
        stop() {
            this.array = [];
        }
        resize() {
            for (const absorber of this.array) {
                absorber.resize();
            }
        }
        handleClickMode(mode) {
            const absorberOptions = this.absorbers, modeAbsorbers = this.interactivityAbsorbers;
            if (mode === "absorber") {
                let absorbersModeOptions;
                if (modeAbsorbers instanceof Array) {
                    if (modeAbsorbers.length > 0) {
                        absorbersModeOptions = itemFromArray(modeAbsorbers);
                    }
                }
                else {
                    absorbersModeOptions = modeAbsorbers;
                }
                const absorbersOptions = absorbersModeOptions !== null && absorbersModeOptions !== void 0 ? absorbersModeOptions : (absorberOptions instanceof Array ? itemFromArray(absorberOptions) : absorberOptions), aPosition = this.container.interactivity.mouse.clickPosition;
                this.addAbsorber(absorbersOptions, aPosition);
            }
        }
        addAbsorber(options, position) {
            const absorber = new AbsorberInstance(this, this.container, options, position);
            this.array.push(absorber);
            return absorber;
        }
        removeAbsorber(absorber) {
            const index = this.array.indexOf(absorber);
            if (index >= 0) {
                this.array.splice(index, 1);
            }
        }
    }

    class AbsorbersPlugin {
        constructor() {
            this.id = "absorbers";
        }
        getPlugin(container) {
            return new Absorbers(container);
        }
        needsPlugin(options) {
            var _a, _b, _c;
            if (!options) {
                return false;
            }
            const absorbers = options.absorbers;
            if (absorbers instanceof Array) {
                return !!absorbers.length;
            }
            else if (absorbers) {
                return true;
            }
            else if (((_c = (_b = (_a = options.interactivity) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b.onClick) === null || _c === void 0 ? void 0 : _c.mode) &&
                isInArray("absorber", options.interactivity.events.onClick.mode)) {
                return true;
            }
            return false;
        }
        loadOptions(options, source) {
            var _a, _b;
            if (!this.needsPlugin(options) && !this.needsPlugin(source)) {
                return;
            }
            const optionsCast = options;
            if (source === null || source === void 0 ? void 0 : source.absorbers) {
                if ((source === null || source === void 0 ? void 0 : source.absorbers) instanceof Array) {
                    optionsCast.absorbers = source === null || source === void 0 ? void 0 : source.absorbers.map((s) => {
                        const tmp = new Absorber();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    let absorberOptions = optionsCast.absorbers;
                    if ((absorberOptions === null || absorberOptions === void 0 ? void 0 : absorberOptions.load) === undefined) {
                        optionsCast.absorbers = absorberOptions = new Absorber();
                    }
                    absorberOptions.load(source === null || source === void 0 ? void 0 : source.absorbers);
                }
            }
            const interactivityAbsorbers = (_b = (_a = source === null || source === void 0 ? void 0 : source.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.absorbers;
            if (interactivityAbsorbers) {
                if (interactivityAbsorbers instanceof Array) {
                    optionsCast.interactivity.modes.absorbers = interactivityAbsorbers.map((s) => {
                        const tmp = new Absorber();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    let absorberOptions = optionsCast.interactivity.modes.absorbers;
                    if ((absorberOptions === null || absorberOptions === void 0 ? void 0 : absorberOptions.load) === undefined) {
                        optionsCast.interactivity.modes.absorbers = absorberOptions = new Absorber();
                    }
                    absorberOptions.load(interactivityAbsorbers);
                }
            }
        }
    }
    async function loadAbsorbersPlugin(engine) {
        const plugin = new AbsorbersPlugin();
        await engine.addPlugin(plugin);
    }

    class CircleShape {
        randomPosition(position, size, fill) {
            const generateTheta = (x, y) => {
                const u = Math.random() / 4.0, theta = Math.atan((y / x) * Math.tan(2 * Math.PI * u)), v = Math.random();
                if (v < 0.25) {
                    return theta;
                }
                else if (v < 0.5) {
                    return Math.PI - theta;
                }
                else if (v < 0.75) {
                    return Math.PI + theta;
                }
                else {
                    return -theta;
                }
            }, radius = (x, y, theta) => (x * y) / Math.sqrt((y * Math.cos(theta)) ** 2 + (x * Math.sin(theta)) ** 2), [a, b] = [size.width / 2, size.height / 2], randomTheta = generateTheta(a, b), maxRadius = radius(a, b, randomTheta), randomRadius = fill ? maxRadius * Math.sqrt(Math.random()) : maxRadius;
            return {
                x: position.x + randomRadius * Math.cos(randomTheta),
                y: position.y + randomRadius * Math.sin(randomTheta),
            };
        }
    }

    class EmitterLife {
        constructor() {
            this.wait = false;
        }
        load(data) {
            if (data === undefined) {
                return;
            }
            if (data.count !== undefined) {
                this.count = data.count;
            }
            if (data.delay !== undefined) {
                this.delay = data.delay;
            }
            if (data.duration !== undefined) {
                this.duration = data.duration;
            }
            if (data.wait !== undefined) {
                this.wait = data.wait;
            }
        }
    }

    class EmitterRate {
        constructor() {
            this.quantity = 1;
            this.delay = 0.1;
        }
        load(data) {
            if (data === undefined) {
                return;
            }
            if (data.quantity !== undefined) {
                this.quantity = setRangeValue(data.quantity);
            }
            if (data.delay !== undefined) {
                this.delay = setRangeValue(data.delay);
            }
        }
    }

    class EmitterSize {
        constructor() {
            this.mode = "percent";
            this.height = 0;
            this.width = 0;
        }
        load(data) {
            if (data === undefined) {
                return;
            }
            if (data.mode !== undefined) {
                this.mode = data.mode;
            }
            if (data.height !== undefined) {
                this.height = data.height;
            }
            if (data.width !== undefined) {
                this.width = data.width;
            }
        }
    }

    class Emitter {
        constructor() {
            this.autoPlay = true;
            this.fill = true;
            this.life = new EmitterLife();
            this.rate = new EmitterRate();
            this.shape = "square";
            this.startCount = 0;
        }
        load(data) {
            if (data === undefined) {
                return;
            }
            if (data.autoPlay !== undefined) {
                this.autoPlay = data.autoPlay;
            }
            if (data.size !== undefined) {
                if (this.size === undefined) {
                    this.size = new EmitterSize();
                }
                this.size.load(data.size);
            }
            if (data.direction !== undefined) {
                this.direction = data.direction;
            }
            this.domId = data.domId;
            if (data.fill !== undefined) {
                this.fill = data.fill;
            }
            this.life.load(data.life);
            this.name = data.name;
            if (data.particles !== undefined) {
                this.particles = deepExtend({}, data.particles);
            }
            this.rate.load(data.rate);
            if (data.shape !== undefined) {
                this.shape = data.shape;
            }
            if (data.position !== undefined) {
                this.position = {};
                if (data.position.x !== undefined) {
                    this.position.x = setRangeValue(data.position.x);
                }
                if (data.position.y !== undefined) {
                    this.position.y = setRangeValue(data.position.y);
                }
            }
            if (data.spawnColor !== undefined) {
                if (this.spawnColor === undefined) {
                    this.spawnColor = new AnimatableColor();
                }
                this.spawnColor.load(data.spawnColor);
            }
            if (data.startCount !== undefined) {
                this.startCount = data.startCount;
            }
        }
    }

    var __classPrivateFieldSet$6 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$5 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _EmitterInstance_firstSpawn, _EmitterInstance_startParticlesAdded, _EmitterInstance_engine;
    class EmitterInstance {
        constructor(engine, emitters, container, options, position) {
            var _a, _b, _c, _d, _e, _f, _g;
            var _h;
            this.emitters = emitters;
            this.container = container;
            _EmitterInstance_firstSpawn.set(this, void 0);
            _EmitterInstance_startParticlesAdded.set(this, void 0);
            _EmitterInstance_engine.set(this, void 0);
            __classPrivateFieldSet$6(this, _EmitterInstance_engine, engine, "f");
            this.currentDuration = 0;
            this.currentEmitDelay = 0;
            this.currentSpawnDelay = 0;
            this.initialPosition = position;
            if (options instanceof Emitter) {
                this.options = options;
            }
            else {
                this.options = new Emitter();
                this.options.load(options);
            }
            this.spawnDelay = (((_a = this.options.life.delay) !== null && _a !== void 0 ? _a : 0) * 1000) / this.container.retina.reduceFactor;
            this.position = (_b = this.initialPosition) !== null && _b !== void 0 ? _b : this.calcPosition();
            this.name = this.options.name;
            this.shape = (_c = __classPrivateFieldGet$5(this, _EmitterInstance_engine, "f").emitterShapeManager) === null || _c === void 0 ? void 0 : _c.getShape(this.options.shape);
            this.fill = this.options.fill;
            __classPrivateFieldSet$6(this, _EmitterInstance_firstSpawn, !this.options.life.wait, "f");
            __classPrivateFieldSet$6(this, _EmitterInstance_startParticlesAdded, false, "f");
            let particlesOptions = deepExtend({}, this.options.particles);
            particlesOptions !== null && particlesOptions !== void 0 ? particlesOptions : (particlesOptions = {});
            (_d = particlesOptions.move) !== null && _d !== void 0 ? _d : (particlesOptions.move = {});
            (_e = (_h = particlesOptions.move).direction) !== null && _e !== void 0 ? _e : (_h.direction = this.options.direction);
            if (this.options.spawnColor) {
                this.spawnColor = colorToHsl(this.options.spawnColor);
            }
            this.paused = !this.options.autoPlay;
            this.particlesOptions = particlesOptions;
            this.size =
                (_f = this.options.size) !== null && _f !== void 0 ? _f : (() => {
                    const size = new EmitterSize();
                    size.load({
                        height: 0,
                        mode: "percent",
                        width: 0,
                    });
                    return size;
                })();
            this.lifeCount = (_g = this.options.life.count) !== null && _g !== void 0 ? _g : -1;
            this.immortal = this.lifeCount <= 0;
            __classPrivateFieldGet$5(this, _EmitterInstance_engine, "f").dispatchEvent("emitterCreated", {
                container,
                data: {
                    emitter: this,
                },
            });
            this.play();
        }
        externalPlay() {
            this.paused = false;
            this.play();
        }
        externalPause() {
            this.paused = true;
            this.pause();
        }
        play() {
            var _a;
            if (this.paused) {
                return;
            }
            if (!(this.container.retina.reduceFactor &&
                (this.lifeCount > 0 || this.immortal || !this.options.life.count) &&
                (__classPrivateFieldGet$5(this, _EmitterInstance_firstSpawn, "f") || this.currentSpawnDelay >= ((_a = this.spawnDelay) !== null && _a !== void 0 ? _a : 0)))) {
                return;
            }
            if (this.emitDelay === undefined) {
                const delay = getRangeValue(this.options.rate.delay);
                this.emitDelay = (1000 * delay) / this.container.retina.reduceFactor;
            }
            if (this.lifeCount > 0 || this.immortal) {
                this.prepareToDie();
            }
        }
        pause() {
            if (this.paused) {
                return;
            }
            delete this.emitDelay;
        }
        resize() {
            const initialPosition = this.initialPosition;
            this.position =
                initialPosition && isPointInside(initialPosition, this.container.canvas.size, Vector.origin)
                    ? initialPosition
                    : this.calcPosition();
        }
        update(delta) {
            var _a, _b, _c;
            if (this.paused) {
                return;
            }
            if (__classPrivateFieldGet$5(this, _EmitterInstance_firstSpawn, "f")) {
                __classPrivateFieldSet$6(this, _EmitterInstance_firstSpawn, false, "f");
                this.currentSpawnDelay = (_a = this.spawnDelay) !== null && _a !== void 0 ? _a : 0;
                this.currentEmitDelay = (_b = this.emitDelay) !== null && _b !== void 0 ? _b : 0;
            }
            if (!__classPrivateFieldGet$5(this, _EmitterInstance_startParticlesAdded, "f")) {
                __classPrivateFieldSet$6(this, _EmitterInstance_startParticlesAdded, true, "f");
                this.emitParticles(this.options.startCount);
            }
            if (this.duration !== undefined) {
                this.currentDuration += delta.value;
                if (this.currentDuration >= this.duration) {
                    this.pause();
                    if (this.spawnDelay !== undefined) {
                        delete this.spawnDelay;
                    }
                    if (!this.immortal) {
                        this.lifeCount--;
                    }
                    if (this.lifeCount > 0 || this.immortal) {
                        this.position = this.calcPosition();
                        this.spawnDelay = (((_c = this.options.life.delay) !== null && _c !== void 0 ? _c : 0) * 1000) / this.container.retina.reduceFactor;
                    }
                    else {
                        this.destroy();
                    }
                    this.currentDuration -= this.duration;
                    delete this.duration;
                }
            }
            if (this.spawnDelay !== undefined) {
                this.currentSpawnDelay += delta.value;
                if (this.currentSpawnDelay >= this.spawnDelay) {
                    __classPrivateFieldGet$5(this, _EmitterInstance_engine, "f").dispatchEvent("emitterPlay", {
                        container: this.container,
                    });
                    this.play();
                    this.currentSpawnDelay -= this.currentSpawnDelay;
                    delete this.spawnDelay;
                }
            }
            if (this.emitDelay !== undefined) {
                this.currentEmitDelay += delta.value;
                if (this.currentEmitDelay >= this.emitDelay) {
                    this.emit();
                    this.currentEmitDelay -= this.emitDelay;
                }
            }
        }
        getPosition() {
            if (this.options.domId) {
                const container = this.container, element = document.getElementById(this.options.domId);
                if (element) {
                    const elRect = element.getBoundingClientRect();
                    return {
                        x: (elRect.x + elRect.width / 2) * container.retina.pixelRatio,
                        y: (elRect.y + elRect.height / 2) * container.retina.pixelRatio,
                    };
                }
            }
            return this.position;
        }
        getSize() {
            const container = this.container;
            if (this.options.domId) {
                const element = document.getElementById(this.options.domId);
                if (element) {
                    const elRect = element.getBoundingClientRect();
                    return {
                        width: elRect.width * container.retina.pixelRatio,
                        height: elRect.height * container.retina.pixelRatio,
                    };
                }
            }
            return {
                width: this.size.mode === "percent"
                    ? (container.canvas.size.width * this.size.width) / 100
                    : this.size.width,
                height: this.size.mode === "percent"
                    ? (container.canvas.size.height * this.size.height) / 100
                    : this.size.height,
            };
        }
        prepareToDie() {
            var _a;
            if (this.paused) {
                return;
            }
            const duration = (_a = this.options.life) === null || _a === void 0 ? void 0 : _a.duration;
            if (this.container.retina.reduceFactor &&
                (this.lifeCount > 0 || this.immortal) &&
                duration !== undefined &&
                duration > 0) {
                this.duration = duration * 1000;
            }
        }
        destroy() {
            this.emitters.removeEmitter(this);
            __classPrivateFieldGet$5(this, _EmitterInstance_engine, "f").dispatchEvent("emitterDestroyed", {
                container: this.container,
                data: {
                    emitter: this,
                },
            });
        }
        calcPosition() {
            return calcPositionOrRandomFromSizeRanged({
                size: this.container.canvas.size,
                position: this.options.position,
            });
        }
        emit() {
            if (this.paused) {
                return;
            }
            const quantity = getRangeValue(this.options.rate.quantity);
            this.emitParticles(quantity);
        }
        emitParticles(quantity) {
            var _a, _b, _c;
            const position = this.getPosition(), size = this.getSize();
            for (let i = 0; i < quantity; i++) {
                const particlesOptions = deepExtend({}, this.particlesOptions);
                if (this.spawnColor) {
                    const hslAnimation = (_a = this.options.spawnColor) === null || _a === void 0 ? void 0 : _a.animation;
                    if (hslAnimation) {
                        this.spawnColor.h = this.setColorAnimation(hslAnimation.h, this.spawnColor.h, 360);
                        this.spawnColor.s = this.setColorAnimation(hslAnimation.s, this.spawnColor.s, 100);
                        this.spawnColor.l = this.setColorAnimation(hslAnimation.l, this.spawnColor.l, 100);
                    }
                    if (!particlesOptions.color) {
                        particlesOptions.color = {
                            value: this.spawnColor,
                        };
                    }
                    else {
                        particlesOptions.color.value = this.spawnColor;
                    }
                }
                if (!position) {
                    return;
                }
                const pPosition = (_c = (_b = this.shape) === null || _b === void 0 ? void 0 : _b.randomPosition(position, size, this.fill)) !== null && _c !== void 0 ? _c : position;
                this.container.particles.addParticle(pPosition, particlesOptions);
            }
        }
        setColorAnimation(animation, initValue, maxValue) {
            var _a;
            const container = this.container;
            if (!animation.enable) {
                return initValue;
            }
            const colorOffset = randomInRange(animation.offset), delay = getRangeValue(this.options.rate.delay), emitFactor = (1000 * delay) / container.retina.reduceFactor, colorSpeed = getRangeValue((_a = animation.speed) !== null && _a !== void 0 ? _a : 0);
            return (initValue + (colorSpeed * container.fpsLimit) / emitFactor + colorOffset * 3.6) % maxValue;
        }
    }
    _EmitterInstance_firstSpawn = new WeakMap(), _EmitterInstance_startParticlesAdded = new WeakMap(), _EmitterInstance_engine = new WeakMap();

    var __classPrivateFieldSet$5 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$4 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Emitters_engine;
    class Emitters {
        constructor(engine, container) {
            this.container = container;
            _Emitters_engine.set(this, void 0);
            __classPrivateFieldSet$5(this, _Emitters_engine, engine, "f");
            this.array = [];
            this.emitters = [];
            this.interactivityEmitters = [];
            container.getEmitter = (idxOrName) => idxOrName === undefined || typeof idxOrName === "number"
                ? this.array[idxOrName || 0]
                : this.array.find((t) => t.name === idxOrName);
            container.addEmitter = (options, position) => this.addEmitter(options, position);
            container.removeEmitter = (idxOrName) => {
                const emitter = container.getEmitter(idxOrName);
                if (emitter) {
                    this.removeEmitter(emitter);
                }
            };
            container.playEmitter = (idxOrName) => {
                const emitter = container.getEmitter(idxOrName);
                if (emitter) {
                    emitter.externalPlay();
                }
            };
            container.pauseEmitter = (idxOrName) => {
                const emitter = container.getEmitter(idxOrName);
                if (emitter) {
                    emitter.externalPause();
                }
            };
        }
        init(options) {
            var _a, _b;
            if (!options) {
                return;
            }
            if (options.emitters) {
                if (options.emitters instanceof Array) {
                    this.emitters = options.emitters.map((s) => {
                        const tmp = new Emitter();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    if (this.emitters instanceof Array) {
                        this.emitters = new Emitter();
                    }
                    this.emitters.load(options.emitters);
                }
            }
            const interactivityEmitters = (_b = (_a = options.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.emitters;
            if (interactivityEmitters) {
                if (interactivityEmitters instanceof Array) {
                    this.interactivityEmitters = interactivityEmitters.map((s) => {
                        const tmp = new Emitter();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    if (this.interactivityEmitters instanceof Array) {
                        this.interactivityEmitters = new Emitter();
                    }
                    this.interactivityEmitters.load(interactivityEmitters);
                }
            }
            if (this.emitters instanceof Array) {
                for (const emitterOptions of this.emitters) {
                    this.addEmitter(emitterOptions);
                }
            }
            else {
                this.addEmitter(this.emitters);
            }
        }
        play() {
            for (const emitter of this.array) {
                emitter.play();
            }
        }
        pause() {
            for (const emitter of this.array) {
                emitter.pause();
            }
        }
        stop() {
            this.array = [];
        }
        update(delta) {
            for (const emitter of this.array) {
                emitter.update(delta);
            }
        }
        handleClickMode(mode) {
            const emitterOptions = this.emitters, modeEmitters = this.interactivityEmitters;
            if (mode === "emitter") {
                let emitterModeOptions;
                if (modeEmitters instanceof Array) {
                    if (modeEmitters.length > 0) {
                        emitterModeOptions = itemFromArray(modeEmitters);
                    }
                }
                else {
                    emitterModeOptions = modeEmitters;
                }
                const emittersOptions = emitterModeOptions !== null && emitterModeOptions !== void 0 ? emitterModeOptions : (emitterOptions instanceof Array ? itemFromArray(emitterOptions) : emitterOptions), ePosition = this.container.interactivity.mouse.clickPosition;
                this.addEmitter(deepExtend({}, emittersOptions), ePosition);
            }
        }
        resize() {
            for (const emitter of this.array) {
                emitter.resize();
            }
        }
        addEmitter(options, position) {
            const emitterOptions = new Emitter();
            emitterOptions.load(options);
            const emitter = new EmitterInstance(__classPrivateFieldGet$4(this, _Emitters_engine, "f"), this, this.container, emitterOptions, position);
            this.array.push(emitter);
            return emitter;
        }
        removeEmitter(emitter) {
            const index = this.array.indexOf(emitter);
            if (index >= 0) {
                this.array.splice(index, 1);
            }
        }
    }
    _Emitters_engine = new WeakMap();

    var __classPrivateFieldSet$4 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var _ShapeManager_engine;
    const shapes = new Map();
    class ShapeManager {
        constructor(engine) {
            _ShapeManager_engine.set(this, void 0);
            __classPrivateFieldSet$4(this, _ShapeManager_engine, engine, "f");
        }
        addShape(name, drawer) {
            if (!this.getShape(name)) {
                shapes.set(name, drawer);
            }
        }
        getShape(name) {
            return shapes.get(name);
        }
        getSupportedShapes() {
            return shapes.keys();
        }
    }
    _ShapeManager_engine = new WeakMap();

    function randomSquareCoordinate(position, offset) {
        return position + offset * (Math.random() - 0.5);
    }
    class SquareShape {
        randomPosition(position, size, fill) {
            if (fill) {
                return {
                    x: randomSquareCoordinate(position.x, size.width),
                    y: randomSquareCoordinate(position.y, size.height),
                };
            }
            else {
                const halfW = size.width / 2, halfH = size.height / 2, side = Math.floor(Math.random() * 4), v = (Math.random() - 0.5) * 2;
                switch (side) {
                    case 0:
                        return {
                            x: position.x + v * halfW,
                            y: position.y - halfH,
                        };
                    case 1:
                        return {
                            x: position.x - halfW,
                            y: position.y + v * halfH,
                        };
                    case 2:
                        return {
                            x: position.x + v * halfW,
                            y: position.y + halfH,
                        };
                    case 3:
                    default:
                        return {
                            x: position.x + halfW,
                            y: position.y + v * halfH,
                        };
                }
            }
        }
    }

    var __classPrivateFieldSet$3 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$3 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _EmittersPlugin_engine;
    class EmittersPlugin {
        constructor(engine) {
            _EmittersPlugin_engine.set(this, void 0);
            __classPrivateFieldSet$3(this, _EmittersPlugin_engine, engine, "f");
            this.id = "emitters";
        }
        getPlugin(container) {
            return new Emitters(__classPrivateFieldGet$3(this, _EmittersPlugin_engine, "f"), container);
        }
        needsPlugin(options) {
            var _a, _b, _c;
            if (options === undefined) {
                return false;
            }
            const emitters = options.emitters;
            return ((emitters instanceof Array && !!emitters.length) ||
                emitters !== undefined ||
                (!!((_c = (_b = (_a = options.interactivity) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b.onClick) === null || _c === void 0 ? void 0 : _c.mode) &&
                    isInArray("emitter", options.interactivity.events.onClick.mode)));
        }
        loadOptions(options, source) {
            var _a, _b;
            if (!this.needsPlugin(options) && !this.needsPlugin(source)) {
                return;
            }
            const optionsCast = options;
            if (source === null || source === void 0 ? void 0 : source.emitters) {
                if ((source === null || source === void 0 ? void 0 : source.emitters) instanceof Array) {
                    optionsCast.emitters = source === null || source === void 0 ? void 0 : source.emitters.map((s) => {
                        const tmp = new Emitter();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    let emitterOptions = optionsCast.emitters;
                    if ((emitterOptions === null || emitterOptions === void 0 ? void 0 : emitterOptions.load) === undefined) {
                        optionsCast.emitters = emitterOptions = new Emitter();
                    }
                    emitterOptions.load(source === null || source === void 0 ? void 0 : source.emitters);
                }
            }
            const interactivityEmitters = (_b = (_a = source === null || source === void 0 ? void 0 : source.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.emitters;
            if (interactivityEmitters) {
                if (interactivityEmitters instanceof Array) {
                    optionsCast.interactivity.modes.emitters = interactivityEmitters.map((s) => {
                        const tmp = new Emitter();
                        tmp.load(s);
                        return tmp;
                    });
                }
                else {
                    let emitterOptions = optionsCast.interactivity.modes.emitters;
                    if ((emitterOptions === null || emitterOptions === void 0 ? void 0 : emitterOptions.load) === undefined) {
                        optionsCast.interactivity.modes.emitters = emitterOptions = new Emitter();
                    }
                    emitterOptions.load(interactivityEmitters);
                }
            }
        }
    }
    _EmittersPlugin_engine = new WeakMap();
    async function loadEmittersPlugin(engine) {
        if (!engine.emitterShapeManager) {
            engine.emitterShapeManager = new ShapeManager(engine);
        }
        if (!engine.addEmitterShape) {
            engine.addEmitterShape = (name, shape) => {
                var _a;
                (_a = engine.emitterShapeManager) === null || _a === void 0 ? void 0 : _a.addShape(name, shape);
            };
        }
        const plugin = new EmittersPlugin(engine);
        await engine.addPlugin(plugin);
        engine.addEmitterShape("circle", new CircleShape());
        engine.addEmitterShape("square", new SquareShape());
    }

    class TrailMaker extends ExternalInteractorBase {
        constructor(container) {
            super(container);
            this.delay = 0;
        }
        async interact(delta) {
            var _a, _b, _c, _d;
            if (!this.container.retina.reduceFactor) {
                return;
            }
            const container = this.container, options = container.actualOptions, trailOptions = options.interactivity.modes.trail, optDelay = (trailOptions.delay * 1000) / this.container.retina.reduceFactor;
            if (this.delay < optDelay) {
                this.delay += delta.value;
            }
            if (this.delay < optDelay) {
                return;
            }
            let canEmit = true;
            if (trailOptions.pauseOnStop) {
                if (container.interactivity.mouse.position === this.lastPosition ||
                    (((_a = container.interactivity.mouse.position) === null || _a === void 0 ? void 0 : _a.x) === ((_b = this.lastPosition) === null || _b === void 0 ? void 0 : _b.x) &&
                        ((_c = container.interactivity.mouse.position) === null || _c === void 0 ? void 0 : _c.y) === ((_d = this.lastPosition) === null || _d === void 0 ? void 0 : _d.y))) {
                    canEmit = false;
                }
            }
            if (container.interactivity.mouse.position) {
                this.lastPosition = {
                    x: container.interactivity.mouse.position.x,
                    y: container.interactivity.mouse.position.y,
                };
            }
            else {
                delete this.lastPosition;
            }
            if (canEmit) {
                container.particles.push(trailOptions.quantity, container.interactivity.mouse, trailOptions.particles);
            }
            this.delay -= optDelay;
        }
        isEnabled() {
            const container = this.container, options = container.actualOptions, mouse = container.interactivity.mouse, events = options.interactivity.events;
            return ((mouse.clicking && mouse.inside && !!mouse.position && isInArray("trail", events.onClick.mode)) ||
                (mouse.inside && !!mouse.position && isInArray("trail", events.onHover.mode)));
        }
        reset() {
        }
    }

    async function loadExternalTrailInteraction(engine) {
        await engine.addInteractor("externalTrail", (container) => new TrailMaker(container));
    }

    class PolygonMaskDrawStroke {
        constructor() {
            this.color = new OptionsColor();
            this.width = 0.5;
            this.opacity = 1;
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            this.color = OptionsColor.create(this.color, data.color);
            if (typeof this.color.value === "string") {
                this.opacity = (_a = stringToAlpha(this.color.value)) !== null && _a !== void 0 ? _a : this.opacity;
            }
            if (data.opacity !== undefined) {
                this.opacity = data.opacity;
            }
            if (data.width !== undefined) {
                this.width = data.width;
            }
        }
    }

    class PolygonMaskDraw {
        constructor() {
            this.enable = false;
            this.stroke = new PolygonMaskDrawStroke();
        }
        get lineWidth() {
            return this.stroke.width;
        }
        set lineWidth(value) {
            this.stroke.width = value;
        }
        get lineColor() {
            return this.stroke.color;
        }
        set lineColor(value) {
            this.stroke.color = OptionsColor.create(this.stroke.color, value);
        }
        load(data) {
            var _a;
            if (!data) {
                return;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            const stroke = (_a = data.stroke) !== null && _a !== void 0 ? _a : {
                color: data.lineColor,
                width: data.lineWidth,
            };
            this.stroke.load(stroke);
        }
    }

    class PolygonMaskInline {
        constructor() {
            this.arrangement = "one-per-point";
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.arrangement !== undefined) {
                this.arrangement = data.arrangement;
            }
        }
    }

    class PolygonMaskLocalSvg {
        constructor() {
            this.path = [];
            this.size = {
                height: 0,
                width: 0,
            };
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.path !== undefined) {
                this.path = data.path;
            }
            if (data.size !== undefined) {
                if (data.size.width !== undefined) {
                    this.size.width = data.size.width;
                }
                if (data.size.height !== undefined) {
                    this.size.height = data.size.height;
                }
            }
        }
    }

    class PolygonMaskMove {
        constructor() {
            this.radius = 10;
            this.type = "path";
        }
        load(data) {
            if (!data) {
                return;
            }
            if (data.radius !== undefined) {
                this.radius = data.radius;
            }
            if (data.type !== undefined) {
                this.type = data.type;
            }
        }
    }

    class PolygonMask {
        constructor() {
            this.draw = new PolygonMaskDraw();
            this.enable = false;
            this.inline = new PolygonMaskInline();
            this.move = new PolygonMaskMove();
            this.scale = 1;
            this.type = "none";
        }
        get inlineArrangement() {
            return this.inline.arrangement;
        }
        set inlineArrangement(value) {
            this.inline.arrangement = value;
        }
        load(data) {
            if (!data) {
                return;
            }
            this.draw.load(data.draw);
            this.inline.load(data.inline);
            this.move.load(data.move);
            if (data.scale !== undefined) {
                this.scale = data.scale;
            }
            if (data.type !== undefined) {
                this.type = data.type;
            }
            if (data.enable !== undefined) {
                this.enable = data.enable;
            }
            else {
                this.enable = this.type !== "none";
            }
            if (data.url !== undefined) {
                this.url = data.url;
            }
            if (data.data !== undefined) {
                if (typeof data.data === "string") {
                    this.data = data.data;
                }
                else {
                    this.data = new PolygonMaskLocalSvg();
                    this.data.load(data.data);
                }
            }
            if (data.position !== undefined) {
                this.position = deepExtend({}, data.position);
            }
        }
    }

    function drawPolygonMask(context, rawData, stroke) {
        const color = colorToRgb(stroke.color);
        if (!color) {
            return;
        }
        context.beginPath();
        context.moveTo(rawData[0].x, rawData[0].y);
        for (const item of rawData) {
            context.lineTo(item.x, item.y);
        }
        context.closePath();
        context.strokeStyle = getStyleFromRgb(color);
        context.lineWidth = stroke.width;
        context.stroke();
    }
    function drawPolygonMaskPath(context, path, stroke, position) {
        context.translate(position.x, position.y);
        const color = colorToRgb(stroke.color);
        if (!color) {
            return;
        }
        context.strokeStyle = getStyleFromRgb(color, stroke.opacity);
        context.lineWidth = stroke.width;
        context.stroke(path);
    }
    function parsePaths(paths, scale, offset) {
        var _a;
        const res = [];
        for (const path of paths) {
            const segments = path.element.pathSegList, len = (_a = segments === null || segments === void 0 ? void 0 : segments.numberOfItems) !== null && _a !== void 0 ? _a : 0, p = {
                x: 0,
                y: 0,
            };
            for (let i = 0; i < len; i++) {
                const segment = segments === null || segments === void 0 ? void 0 : segments.getItem(i);
                const svgPathSeg = window.SVGPathSeg;
                switch (segment === null || segment === void 0 ? void 0 : segment.pathSegType) {
                    case svgPathSeg.PATHSEG_MOVETO_ABS:
                    case svgPathSeg.PATHSEG_LINETO_ABS:
                    case svgPathSeg.PATHSEG_CURVETO_CUBIC_ABS:
                    case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS:
                    case svgPathSeg.PATHSEG_ARC_ABS:
                    case svgPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS:
                    case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS: {
                        const absSeg = segment;
                        p.x = absSeg.x;
                        p.y = absSeg.y;
                        break;
                    }
                    case svgPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS:
                        p.x = segment.x;
                        break;
                    case svgPathSeg.PATHSEG_LINETO_VERTICAL_ABS:
                        p.y = segment.y;
                        break;
                    case svgPathSeg.PATHSEG_LINETO_REL:
                    case svgPathSeg.PATHSEG_MOVETO_REL:
                    case svgPathSeg.PATHSEG_CURVETO_CUBIC_REL:
                    case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_REL:
                    case svgPathSeg.PATHSEG_ARC_REL:
                    case svgPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL:
                    case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL: {
                        const relSeg = segment;
                        p.x += relSeg.x;
                        p.y += relSeg.y;
                        break;
                    }
                    case svgPathSeg.PATHSEG_LINETO_HORIZONTAL_REL:
                        p.x += segment.x;
                        break;
                    case svgPathSeg.PATHSEG_LINETO_VERTICAL_REL:
                        p.y += segment.y;
                        break;
                    case svgPathSeg.PATHSEG_UNKNOWN:
                    case svgPathSeg.PATHSEG_CLOSEPATH:
                        continue;
                }
                res.push({
                    x: p.x * scale + offset.x,
                    y: p.y * scale + offset.y,
                });
            }
        }
        return res;
    }
    function calcClosestPtOnSegment(s1, s2, pos) {
        const { dx, dy } = getDistances(pos, s1), { dx: dxx, dy: dyy } = getDistances(s2, s1), t = (dx * dxx + dy * dyy) / (dxx ** 2 + dyy ** 2), res = {
            x: s1.x + dxx * t,
            y: s1.x + dyy * t,
            isOnSegment: t >= 0 && t <= 1,
        };
        if (t < 0) {
            res.x = s1.x;
            res.y = s1.y;
        }
        else if (t > 1) {
            res.x = s2.x;
            res.y = s2.y;
        }
        return res;
    }
    function segmentBounce(start, stop, velocity) {
        const { dx, dy } = getDistances(start, stop), wallAngle = Math.atan2(dy, dx), wallNormal = Vector.create(Math.sin(wallAngle), -Math.cos(wallAngle)), d = 2 * (velocity.x * wallNormal.x + velocity.y * wallNormal.y);
        wallNormal.multTo(d);
        velocity.subFrom(wallNormal);
    }

    var __classPrivateFieldSet$2 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$2 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _PolygonMaskInstance_engine;
    class PolygonMaskInstance {
        constructor(container, engine) {
            this.container = container;
            _PolygonMaskInstance_engine.set(this, void 0);
            __classPrivateFieldSet$2(this, _PolygonMaskInstance_engine, engine, "f");
            this.dimension = {
                height: 0,
                width: 0,
            };
            this.path2DSupported = !!window.Path2D;
            this.options = new PolygonMask();
            this.polygonMaskMoveRadius = this.options.move.radius * container.retina.pixelRatio;
        }
        async initAsync(options) {
            this.options.load(options === null || options === void 0 ? void 0 : options.polygon);
            const polygonMaskOptions = this.options;
            this.polygonMaskMoveRadius = polygonMaskOptions.move.radius * this.container.retina.pixelRatio;
            if (polygonMaskOptions.enable) {
                await this.initRawData();
            }
        }
        resize() {
            const container = this.container, options = this.options;
            if (!(options.enable && options.type !== "none")) {
                return;
            }
            if (this.redrawTimeout) {
                clearTimeout(this.redrawTimeout);
            }
            this.redrawTimeout = window.setTimeout(async () => {
                await this.initRawData(true);
                await container.particles.redraw();
            }, 250);
        }
        stop() {
            delete this.raw;
            delete this.paths;
        }
        particlesInitialization() {
            const options = this.options;
            if (options.enable &&
                options.type === "inline" &&
                (options.inline.arrangement === "one-per-point" ||
                    options.inline.arrangement === "per-point")) {
                this.drawPoints();
                return true;
            }
            return false;
        }
        particlePosition(position) {
            var _a, _b;
            const options = this.options;
            if (!(options.enable && ((_b = (_a = this.raw) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0)) {
                return;
            }
            return deepExtend({}, position ? position : this.randomPoint());
        }
        particleBounce(particle, delta, direction) {
            return this.polygonBounce(particle, delta, direction);
        }
        clickPositionValid(position) {
            const options = this.options;
            return (options.enable &&
                options.type !== "none" &&
                options.type !== "inline" &&
                this.checkInsidePolygon(position));
        }
        draw(context) {
            var _a;
            if (!((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length)) {
                return;
            }
            const options = this.options, polygonDraw = options.draw;
            if (!options.enable || !polygonDraw.enable) {
                return;
            }
            const rawData = this.raw;
            for (const path of this.paths) {
                const path2d = path.path2d, path2dSupported = this.path2DSupported;
                if (!context) {
                    continue;
                }
                if (path2dSupported && path2d && this.offset) {
                    drawPolygonMaskPath(context, path2d, polygonDraw.stroke, this.offset);
                }
                else if (rawData) {
                    drawPolygonMask(context, rawData, polygonDraw.stroke);
                }
            }
        }
        polygonBounce(particle, _delta, direction) {
            const options = this.options;
            if (!this.raw || !options.enable || direction !== "top") {
                return false;
            }
            if (options.type === "inside" || options.type === "outside") {
                let closest, dx, dy;
                const pos = particle.getPosition(), radius = particle.getRadius();
                for (let i = 0, j = this.raw.length - 1; i < this.raw.length; j = i++) {
                    const pi = this.raw[i], pj = this.raw[j];
                    closest = calcClosestPtOnSegment(pi, pj, pos);
                    const dist = getDistances(pos, closest);
                    [dx, dy] = [dist.dx, dist.dy];
                    if (dist.distance < radius) {
                        segmentBounce(pi, pj, particle.velocity);
                        return true;
                    }
                }
                if (closest && dx !== undefined && dy !== undefined && !this.checkInsidePolygon(pos)) {
                    const factor = { x: 1, y: 1 };
                    if (particle.position.x >= closest.x) {
                        factor.x = -1;
                    }
                    if (particle.position.y >= closest.y) {
                        factor.y = -1;
                    }
                    particle.position.x = closest.x + radius * 2 * factor.x;
                    particle.position.y = closest.y + radius * 2 * factor.y;
                    particle.velocity.mult(-1);
                    return true;
                }
            }
            else if (options.type === "inline" && particle.initialPosition) {
                const dist = getDistance(particle.initialPosition, particle.getPosition());
                if (dist > this.polygonMaskMoveRadius) {
                    particle.velocity.x = particle.velocity.y / 2 - particle.velocity.x;
                    particle.velocity.y = particle.velocity.x / 2 - particle.velocity.y;
                    return true;
                }
            }
            return false;
        }
        checkInsidePolygon(position) {
            var _a, _b;
            const container = this.container, options = this.options;
            if (!options.enable || options.type === "none" || options.type === "inline") {
                return true;
            }
            if (!this.raw) {
                throw new Error(noPolygonFound);
            }
            const canvasSize = container.canvas.size, x = (_a = position === null || position === void 0 ? void 0 : position.x) !== null && _a !== void 0 ? _a : Math.random() * canvasSize.width, y = (_b = position === null || position === void 0 ? void 0 : position.y) !== null && _b !== void 0 ? _b : Math.random() * canvasSize.height;
            let inside = false;
            for (let i = 0, j = this.raw.length - 1; i < this.raw.length; j = i++) {
                const pi = this.raw[i], pj = this.raw[j], intersect = pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x;
                if (intersect) {
                    inside = !inside;
                }
            }
            return options.type === "inside"
                ? inside
                : options.type === "outside"
                    ? !inside
                    : false;
        }
        parseSvgPath(xml, force) {
            var _a, _b, _c;
            const forceDownload = force !== null && force !== void 0 ? force : false;
            if (this.paths !== undefined && !forceDownload) {
                return this.raw;
            }
            const container = this.container, options = this.options, parser = new DOMParser(), doc = parser.parseFromString(xml, "image/svg+xml"), svg = doc.getElementsByTagName("svg")[0];
            let svgPaths = svg.getElementsByTagName("path");
            if (!svgPaths.length) {
                svgPaths = doc.getElementsByTagName("path");
            }
            this.paths = [];
            for (let i = 0; i < svgPaths.length; i++) {
                const path = svgPaths.item(i);
                if (path) {
                    this.paths.push({
                        element: path,
                        length: path.getTotalLength(),
                    });
                }
            }
            const pxRatio = container.retina.pixelRatio, scale = options.scale / pxRatio;
            this.dimension.width = parseFloat((_a = svg.getAttribute("width")) !== null && _a !== void 0 ? _a : "0") * scale;
            this.dimension.height = parseFloat((_b = svg.getAttribute("height")) !== null && _b !== void 0 ? _b : "0") * scale;
            const position = (_c = options.position) !== null && _c !== void 0 ? _c : {
                x: 50,
                y: 50,
            };
            this.offset = {
                x: (container.canvas.size.width * position.x) / (100 * pxRatio) - this.dimension.width / 2,
                y: (container.canvas.size.height * position.y) / (100 * pxRatio) - this.dimension.height / 2,
            };
            return parsePaths(this.paths, scale, this.offset);
        }
        async downloadSvgPath(svgUrl, force) {
            const options = this.options, url = svgUrl || options.url, forceDownload = force !== null && force !== void 0 ? force : false;
            if (!url || (this.paths !== undefined && !forceDownload)) {
                return this.raw;
            }
            const req = await fetch(url);
            if (!req.ok) {
                throw new Error("tsParticles Error - Error occurred during polygon mask download");
            }
            return this.parseSvgPath(await req.text(), force);
        }
        drawPoints() {
            if (!this.raw) {
                return;
            }
            for (const item of this.raw) {
                this.container.particles.addParticle({
                    x: item.x,
                    y: item.y,
                });
            }
        }
        randomPoint() {
            const container = this.container, options = this.options;
            let position;
            if (options.type === "inline") {
                switch (options.inline.arrangement) {
                    case "random-point":
                        position = this.getRandomPoint();
                        break;
                    case "random-length":
                        position = this.getRandomPointByLength();
                        break;
                    case "equidistant":
                        position = this.getEquidistantPointByIndex(container.particles.count);
                        break;
                    case "one-per-point":
                    case "per-point":
                    default:
                        position = this.getPointByIndex(container.particles.count);
                }
            }
            else {
                position = {
                    x: Math.random() * container.canvas.size.width,
                    y: Math.random() * container.canvas.size.height,
                };
            }
            if (this.checkInsidePolygon(position)) {
                return position;
            }
            else {
                return this.randomPoint();
            }
        }
        getRandomPoint() {
            if (!this.raw || !this.raw.length) {
                throw new Error(noPolygonDataLoaded);
            }
            const coords = itemFromArray(this.raw);
            return {
                x: coords.x,
                y: coords.y,
            };
        }
        getRandomPointByLength() {
            var _a, _b, _c;
            const options = this.options;
            if (!this.raw || !this.raw.length || !((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length)) {
                throw new Error(noPolygonDataLoaded);
            }
            const path = itemFromArray(this.paths), distance = Math.floor(Math.random() * path.length) + 1, point = path.element.getPointAtLength(distance);
            return {
                x: point.x * options.scale + (((_b = this.offset) === null || _b === void 0 ? void 0 : _b.x) || 0),
                y: point.y * options.scale + (((_c = this.offset) === null || _c === void 0 ? void 0 : _c.y) || 0),
            };
        }
        getEquidistantPointByIndex(index) {
            var _a, _b, _c, _d, _e, _f, _g;
            const options = this.container.actualOptions, polygonMaskOptions = this.options;
            if (!this.raw || !this.raw.length || !((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length))
                throw new Error(noPolygonDataLoaded);
            let offset = 0, point;
            const totalLength = this.paths.reduce((tot, path) => tot + path.length, 0), distance = totalLength / options.particles.number.value;
            for (const path of this.paths) {
                const pathDistance = distance * index - offset;
                if (pathDistance <= path.length) {
                    point = path.element.getPointAtLength(pathDistance);
                    break;
                }
                else {
                    offset += path.length;
                }
            }
            return {
                x: ((_b = point === null || point === void 0 ? void 0 : point.x) !== null && _b !== void 0 ? _b : 0) * polygonMaskOptions.scale + ((_d = (_c = this.offset) === null || _c === void 0 ? void 0 : _c.x) !== null && _d !== void 0 ? _d : 0),
                y: ((_e = point === null || point === void 0 ? void 0 : point.y) !== null && _e !== void 0 ? _e : 0) * polygonMaskOptions.scale + ((_g = (_f = this.offset) === null || _f === void 0 ? void 0 : _f.y) !== null && _g !== void 0 ? _g : 0),
            };
        }
        getPointByIndex(index) {
            if (!this.raw || !this.raw.length) {
                throw new Error(noPolygonDataLoaded);
            }
            const coords = this.raw[index % this.raw.length];
            return {
                x: coords.x,
                y: coords.y,
            };
        }
        createPath2D() {
            var _a, _b;
            const options = this.options;
            if (!this.path2DSupported || !((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length)) {
                return;
            }
            for (const path of this.paths) {
                const pathData = (_b = path.element) === null || _b === void 0 ? void 0 : _b.getAttribute("d");
                if (pathData) {
                    const path2d = new Path2D(pathData), matrix = document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGMatrix(), finalPath = new Path2D(), transform = matrix.scale(options.scale);
                    if (finalPath.addPath) {
                        finalPath.addPath(path2d, transform);
                        path.path2d = finalPath;
                    }
                    else {
                        delete path.path2d;
                    }
                }
                else {
                    delete path.path2d;
                }
                if (path.path2d || !this.raw) {
                    continue;
                }
                path.path2d = new Path2D();
                path.path2d.moveTo(this.raw[0].x, this.raw[0].y);
                this.raw.forEach((pos, i) => {
                    var _a;
                    if (i > 0) {
                        (_a = path.path2d) === null || _a === void 0 ? void 0 : _a.lineTo(pos.x, pos.y);
                    }
                });
                path.path2d.closePath();
            }
        }
        async initRawData(force) {
            const options = this.options;
            if (options.url) {
                this.raw = await this.downloadSvgPath(options.url, force);
            }
            else if (options.data) {
                const data = options.data;
                let svg;
                if (typeof data !== "string") {
                    const path = data.path instanceof Array
                        ? data.path.map((t) => `<path d="${t}" />`).join("")
                        : `<path d="${data.path}" />`;
                    const namespaces = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
                    svg = `<svg ${namespaces} width="${data.size.width}" height="${data.size.height}">${path}</svg>`;
                }
                else {
                    svg = data;
                }
                this.raw = this.parseSvgPath(svg, force);
            }
            this.createPath2D();
            __classPrivateFieldGet$2(this, _PolygonMaskInstance_engine, "f").dispatchEvent("polygonMaskLoaded", {
                container: this.container,
            });
        }
    }
    _PolygonMaskInstance_engine = new WeakMap();

    var __classPrivateFieldSet$1 = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet$1 = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _PolygonMaskPlugin_engine;
    class PolygonMaskPlugin {
        constructor(engine) {
            _PolygonMaskPlugin_engine.set(this, void 0);
            this.id = "polygonMask";
            __classPrivateFieldSet$1(this, _PolygonMaskPlugin_engine, engine, "f");
        }
        getPlugin(container) {
            return new PolygonMaskInstance(container, __classPrivateFieldGet$1(this, _PolygonMaskPlugin_engine, "f"));
        }
        needsPlugin(options) {
            var _a, _b, _c;
            return ((_b = (_a = options === null || options === void 0 ? void 0 : options.polygon) === null || _a === void 0 ? void 0 : _a.enable) !== null && _b !== void 0 ? _b : (((_c = options === null || options === void 0 ? void 0 : options.polygon) === null || _c === void 0 ? void 0 : _c.type) !== undefined && options.polygon.type !== "none"));
        }
        loadOptions(options, source) {
            if (!this.needsPlugin(source)) {
                return;
            }
            const optionsCast = options;
            let polygonOptions = optionsCast.polygon;
            if ((polygonOptions === null || polygonOptions === void 0 ? void 0 : polygonOptions.load) === undefined) {
                optionsCast.polygon = polygonOptions = new PolygonMask();
            }
            polygonOptions.load(source === null || source === void 0 ? void 0 : source.polygon);
        }
    }
    _PolygonMaskPlugin_engine = new WeakMap();
    async function loadPolygonMaskPlugin(engine) {
        if (!isSsr() && !("SVGPathSeg" in window)) {
            await Promise.resolve().then(function () { return pathseg; });
        }
        const plugin = new PolygonMaskPlugin(engine);
        await engine.addPlugin(plugin);
    }

    function updateRoll(particle, delta) {
        const roll = particle.options.roll;
        if (!particle.roll || !roll.enable) {
            return;
        }
        const speed = particle.roll.speed * delta.factor;
        const max = 2 * Math.PI;
        particle.roll.angle += speed;
        if (particle.roll.angle > max) {
            particle.roll.angle -= max;
        }
    }
    class RollUpdater {
        init(particle) {
            const rollOpt = particle.options.roll;
            if (rollOpt.enable) {
                particle.roll = {
                    angle: Math.random() * Math.PI * 2,
                    speed: getRangeValue(rollOpt.speed) / 360,
                };
                if (rollOpt.backColor) {
                    particle.backColor = colorToHsl(rollOpt.backColor);
                }
                else if (rollOpt.darken.enable && rollOpt.enlighten.enable) {
                    const alterType = Math.random() >= 0.5 ? "darken" : "enlighten";
                    particle.roll.alter = {
                        type: alterType,
                        value: getRangeValue(alterType === "darken" ? rollOpt.darken.value : rollOpt.enlighten.value),
                    };
                }
                else if (rollOpt.darken.enable) {
                    particle.roll.alter = {
                        type: "darken",
                        value: getRangeValue(rollOpt.darken.value),
                    };
                }
                else if (rollOpt.enlighten.enable) {
                    particle.roll.alter = {
                        type: "enlighten",
                        value: getRangeValue(rollOpt.enlighten.value),
                    };
                }
            }
            else {
                particle.roll = { angle: 0, speed: 0 };
            }
        }
        isEnabled(particle) {
            const roll = particle.options.roll;
            return !particle.destroyed && !particle.spawning && roll.enable;
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            updateRoll(particle, delta);
        }
    }

    async function loadRollUpdater(engine) {
        await engine.addParticleUpdater("roll", () => new RollUpdater());
    }

    const initPjs = (engine) => {
        const particlesJS = (tagId, options) => {
            return engine.load(tagId, options);
        };
        particlesJS.load = (tagId, pathConfigJson, callback) => {
            engine
                .loadJSON(tagId, pathConfigJson)
                .then((container) => {
                if (container) {
                    callback(container);
                }
            })
                .catch(() => {
                callback(undefined);
            });
        };
        particlesJS.setOnClickHandler = (callback) => {
            engine.setOnClickHandler(callback);
        };
        const pJSDom = engine.dom();
        return { particlesJS, pJSDom };
    };

    function updateAngle(particle, delta) {
        var _a;
        const rotate = particle.rotate;
        if (!rotate) {
            return;
        }
        const rotateOptions = particle.options.rotate;
        const rotateAnimation = rotateOptions.animation;
        const speed = ((_a = rotate.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor;
        const max = 2 * Math.PI;
        if (!rotateAnimation.enable) {
            return;
        }
        switch (rotate.status) {
            case 0:
                rotate.value += speed;
                if (rotate.value > max) {
                    rotate.value -= max;
                }
                break;
            case 1:
            default:
                rotate.value -= speed;
                if (rotate.value < 0) {
                    rotate.value += max;
                }
                break;
        }
    }
    class AngleUpdater {
        constructor(container) {
            this.container = container;
        }
        init(particle) {
            const rotateOptions = particle.options.rotate;
            particle.rotate = {
                enable: rotateOptions.animation.enable,
                value: (getRangeValue(rotateOptions.value) * Math.PI) / 180,
            };
            let rotateDirection = rotateOptions.direction;
            if (rotateDirection === "random") {
                const index = Math.floor(Math.random() * 2);
                rotateDirection = index > 0 ? "counter-clockwise" : "clockwise";
            }
            switch (rotateDirection) {
                case "counter-clockwise":
                case "counterClockwise":
                    particle.rotate.status = 1;
                    break;
                case "clockwise":
                    particle.rotate.status = 0;
                    break;
            }
            const rotateAnimation = particle.options.rotate.animation;
            if (rotateAnimation.enable) {
                particle.rotate.velocity =
                    (getRangeValue(rotateAnimation.speed) / 360) * this.container.retina.reduceFactor;
                if (!rotateAnimation.sync) {
                    particle.rotate.velocity *= Math.random();
                }
            }
        }
        isEnabled(particle) {
            const rotate = particle.options.rotate;
            const rotateAnimation = rotate.animation;
            return !particle.destroyed && !particle.spawning && !rotate.path && rotateAnimation.enable;
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            updateAngle(particle, delta);
        }
    }

    async function loadAngleUpdater(engine) {
        await engine.addParticleUpdater("angle", (container) => new AngleUpdater(container));
    }

    function applyDistance(particle) {
        const initialPosition = particle.initialPosition;
        const { dx, dy } = getDistances(initialPosition, particle.position);
        const dxFixed = Math.abs(dx), dyFixed = Math.abs(dy);
        const hDistance = particle.retina.maxDistance.horizontal;
        const vDistance = particle.retina.maxDistance.vertical;
        if (!hDistance && !vDistance) {
            return;
        }
        if (((hDistance && dxFixed >= hDistance) || (vDistance && dyFixed >= vDistance)) && !particle.misplaced) {
            particle.misplaced = (!!hDistance && dxFixed > hDistance) || (!!vDistance && dyFixed > vDistance);
            if (hDistance) {
                particle.velocity.x = particle.velocity.y / 2 - particle.velocity.x;
            }
            if (vDistance) {
                particle.velocity.y = particle.velocity.x / 2 - particle.velocity.y;
            }
        }
        else if ((!hDistance || dxFixed < hDistance) && (!vDistance || dyFixed < vDistance) && particle.misplaced) {
            particle.misplaced = false;
        }
        else if (particle.misplaced) {
            const pos = particle.position, vel = particle.velocity;
            if (hDistance && ((pos.x < initialPosition.x && vel.x < 0) || (pos.x > initialPosition.x && vel.x > 0))) {
                vel.x *= -Math.random();
            }
            if (vDistance && ((pos.y < initialPosition.y && vel.y < 0) || (pos.y > initialPosition.y && vel.y > 0))) {
                vel.y *= -Math.random();
            }
        }
    }
    function spin(particle, moveSpeed) {
        const container = particle.container;
        if (!particle.spin) {
            return;
        }
        const updateFunc = {
            x: particle.spin.direction === "clockwise" ? Math.cos : Math.sin,
            y: particle.spin.direction === "clockwise" ? Math.sin : Math.cos,
        };
        particle.position.x = particle.spin.center.x + particle.spin.radius * updateFunc.x(particle.spin.angle);
        particle.position.y = particle.spin.center.y + particle.spin.radius * updateFunc.y(particle.spin.angle);
        particle.spin.radius += particle.spin.acceleration;
        const maxCanvasSize = Math.max(container.canvas.size.width, container.canvas.size.height);
        if (particle.spin.radius > maxCanvasSize / 2) {
            particle.spin.radius = maxCanvasSize / 2;
            particle.spin.acceleration *= -1;
        }
        else if (particle.spin.radius < 0) {
            particle.spin.radius = 0;
            particle.spin.acceleration *= -1;
        }
        particle.spin.angle += (moveSpeed / 100) * (1 - particle.spin.radius / maxCanvasSize);
    }
    function applyPath(particle, delta) {
        const particlesOptions = particle.options;
        const pathOptions = particlesOptions.move.path;
        const pathEnabled = pathOptions.enable;
        if (!pathEnabled) {
            return;
        }
        const container = particle.container;
        if (particle.lastPathTime <= particle.pathDelay) {
            particle.lastPathTime += delta.value;
            return;
        }
        const path = container.pathGenerator.generate(particle);
        particle.velocity.addTo(path);
        if (pathOptions.clamp) {
            particle.velocity.x = clamp(particle.velocity.x, -1, 1);
            particle.velocity.y = clamp(particle.velocity.y, -1, 1);
        }
        particle.lastPathTime -= particle.pathDelay;
    }
    function getProximitySpeedFactor(particle) {
        const container = particle.container;
        const options = container.actualOptions;
        const active = isInArray("slow", options.interactivity.events.onHover.mode);
        if (!active) {
            return 1;
        }
        const mousePos = particle.container.interactivity.mouse.position;
        if (!mousePos) {
            return 1;
        }
        const particlePos = particle.getPosition();
        const dist = getDistance(mousePos, particlePos);
        const radius = container.retina.slowModeRadius;
        if (dist > radius) {
            return 1;
        }
        const proximityFactor = dist / radius || 0;
        const slowFactor = options.interactivity.modes.slow.factor;
        return proximityFactor / slowFactor;
    }

    class BaseMover {
        init(particle) {
            var _a;
            const container = particle.container, options = particle.options, spinOptions = options.move.spin;
            if (spinOptions.enable) {
                const spinPos = (_a = spinOptions.position) !== null && _a !== void 0 ? _a : { x: 50, y: 50 };
                const spinCenter = {
                    x: (spinPos.x / 100) * container.canvas.size.width,
                    y: (spinPos.y / 100) * container.canvas.size.height,
                };
                const pos = particle.getPosition();
                const distance = getDistance(pos, spinCenter);
                const spinAcceleration = getRangeValue(spinOptions.acceleration);
                particle.retina.spinAcceleration = spinAcceleration * container.retina.pixelRatio;
                particle.spin = {
                    center: spinCenter,
                    direction: particle.velocity.x >= 0 ? "clockwise" : "counter-clockwise",
                    angle: particle.velocity.angle,
                    radius: distance,
                    acceleration: particle.retina.spinAcceleration,
                };
            }
        }
        isEnabled(particle) {
            return !particle.destroyed && particle.options.move.enable;
        }
        move(particle, delta) {
            var _a, _b, _c;
            var _d, _e;
            const particleOptions = particle.options, moveOptions = particleOptions.move;
            if (!moveOptions.enable) {
                return;
            }
            const container = particle.container, slowFactor = getProximitySpeedFactor(particle), baseSpeed = ((_a = (_d = particle.retina).moveSpeed) !== null && _a !== void 0 ? _a : (_d.moveSpeed = getRangeValue(moveOptions.speed) * container.retina.pixelRatio)) *
                container.retina.reduceFactor, moveDrift = ((_b = (_e = particle.retina).moveDrift) !== null && _b !== void 0 ? _b : (_e.moveDrift = getRangeValue(particle.options.move.drift) * container.retina.pixelRatio)), maxSize = getRangeMax(particleOptions.size.value) * container.retina.pixelRatio, sizeFactor = moveOptions.size ? particle.getRadius() / maxSize : 1, speedFactor = sizeFactor * slowFactor * (delta.factor || 1), diffFactor = 2, moveSpeed = (baseSpeed * speedFactor) / diffFactor;
            applyPath(particle, delta);
            const gravityOptions = particle.gravity, gravityFactor = gravityOptions.enable && gravityOptions.inverse ? -1 : 1;
            if (gravityOptions.enable && moveSpeed) {
                particle.velocity.y += (gravityFactor * (gravityOptions.acceleration * delta.factor)) / (60 * moveSpeed);
            }
            if (moveDrift && moveSpeed) {
                particle.velocity.x += (moveDrift * delta.factor) / (60 * moveSpeed);
            }
            const decay = particle.moveDecay;
            if (decay != 1) {
                particle.velocity.multTo(decay);
            }
            const velocity = particle.velocity.mult(moveSpeed), maxSpeed = (_c = particle.retina.maxSpeed) !== null && _c !== void 0 ? _c : container.retina.maxSpeed;
            if (gravityOptions.enable &&
                maxSpeed > 0 &&
                ((!gravityOptions.inverse && velocity.y >= 0 && velocity.y >= maxSpeed) ||
                    (gravityOptions.inverse && velocity.y <= 0 && velocity.y <= -maxSpeed))) {
                velocity.y = gravityFactor * maxSpeed;
                if (moveSpeed) {
                    particle.velocity.y = velocity.y / moveSpeed;
                }
            }
            const zIndexOptions = particle.options.zIndex, zVelocityFactor = (1 - particle.zIndexFactor) ** zIndexOptions.velocityRate;
            if (moveOptions.spin.enable) {
                spin(particle, moveSpeed);
            }
            else {
                if (zVelocityFactor != 1) {
                    velocity.multTo(zVelocityFactor);
                }
                particle.position.addTo(velocity);
                if (moveOptions.vibrate) {
                    particle.position.x += Math.sin(particle.position.x * Math.cos(particle.position.y));
                    particle.position.y += Math.cos(particle.position.y * Math.sin(particle.position.x));
                }
            }
            applyDistance(particle);
        }
    }

    async function loadBaseMover(engine) {
        engine.addMover("base", () => new BaseMover());
    }

    class CircleDrawer {
        getSidesCount() {
            return 12;
        }
        draw(context, particle, radius) {
            context.arc(0, 0, radius, 0, Math.PI * 2, false);
        }
    }

    async function loadCircleShape(engine) {
        await engine.addShape("circle", new CircleDrawer());
    }

    function updateColorValue$1(delta, value, valueAnimation, max, decrease) {
        var _a;
        const colorValue = value;
        if (!colorValue || !valueAnimation.enable) {
            return;
        }
        const offset = randomInRange(valueAnimation.offset);
        const velocity = ((_a = value.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor + offset * 3.6;
        if (!decrease || colorValue.status === 0) {
            colorValue.value += velocity;
            if (decrease && colorValue.value > max) {
                colorValue.status = 1;
                colorValue.value -= colorValue.value % max;
            }
        }
        else {
            colorValue.value -= velocity;
            if (colorValue.value < 0) {
                colorValue.status = 0;
                colorValue.value += colorValue.value;
            }
        }
        if (colorValue.value > max) {
            colorValue.value %= max;
        }
    }
    function updateColor(particle, delta) {
        var _a, _b, _c;
        const animationOptions = particle.options.color.animation;
        if (((_a = particle.color) === null || _a === void 0 ? void 0 : _a.h) !== undefined) {
            updateColorValue$1(delta, particle.color.h, animationOptions.h, 360, false);
        }
        if (((_b = particle.color) === null || _b === void 0 ? void 0 : _b.s) !== undefined) {
            updateColorValue$1(delta, particle.color.s, animationOptions.s, 100, true);
        }
        if (((_c = particle.color) === null || _c === void 0 ? void 0 : _c.l) !== undefined) {
            updateColorValue$1(delta, particle.color.l, animationOptions.l, 100, true);
        }
    }
    class ColorUpdater {
        constructor(container) {
            this.container = container;
        }
        init(particle) {
            const hslColor = colorToHsl(particle.options.color, particle.id, particle.options.reduceDuplicates);
            if (hslColor) {
                particle.color = getHslAnimationFromHsl(hslColor, particle.options.color.animation, this.container.retina.reduceFactor);
            }
        }
        isEnabled(particle) {
            var _a, _b, _c;
            const animationOptions = particle.options.color.animation;
            return (!particle.destroyed &&
                !particle.spawning &&
                ((((_a = particle.color) === null || _a === void 0 ? void 0 : _a.h.value) !== undefined && animationOptions.h.enable) ||
                    (((_b = particle.color) === null || _b === void 0 ? void 0 : _b.s.value) !== undefined && animationOptions.s.enable) ||
                    (((_c = particle.color) === null || _c === void 0 ? void 0 : _c.l.value) !== undefined && animationOptions.l.enable)));
        }
        update(particle, delta) {
            updateColor(particle, delta);
        }
    }

    async function loadColorUpdater(engine) {
        await engine.addParticleUpdater("color", (container) => new ColorUpdater(container));
    }

    class Attractor$1 extends ExternalInteractorBase {
        constructor(container) {
            super(container);
            if (!container.attract) {
                container.attract = { particles: [] };
            }
            this.handleClickMode = (mode) => {
                const options = this.container.actualOptions;
                if (mode !== "attract") {
                    return;
                }
                if (!container.attract) {
                    container.attract = { particles: [] };
                }
                container.attract.clicking = true;
                container.attract.count = 0;
                for (const particle of container.attract.particles) {
                    particle.velocity.setTo(particle.initialVelocity);
                }
                container.attract.particles = [];
                container.attract.finish = false;
                setTimeout(() => {
                    if (!container.destroyed) {
                        if (!container.attract) {
                            container.attract = { particles: [] };
                        }
                        container.attract.clicking = false;
                    }
                }, options.interactivity.modes.attract.duration * 1000);
            };
        }
        isEnabled() {
            const container = this.container, options = container.actualOptions, mouse = container.interactivity.mouse, events = options.interactivity.events;
            if ((!mouse.position || !events.onHover.enable) && (!mouse.clickPosition || !events.onClick.enable)) {
                return false;
            }
            const hoverMode = events.onHover.mode, clickMode = events.onClick.mode;
            return isInArray("attract", hoverMode) || isInArray("attract", clickMode);
        }
        reset() {
        }
        async interact() {
            const container = this.container, options = container.actualOptions, mouseMoveStatus = container.interactivity.status === mouseMoveEvent, events = options.interactivity.events, hoverEnabled = events.onHover.enable, hoverMode = events.onHover.mode, clickEnabled = events.onClick.enable, clickMode = events.onClick.mode;
            if (mouseMoveStatus && hoverEnabled && isInArray("attract", hoverMode)) {
                this.hoverAttract();
            }
            else if (clickEnabled && isInArray("attract", clickMode)) {
                this.clickAttract();
            }
        }
        hoverAttract() {
            const container = this.container;
            const mousePos = container.interactivity.mouse.position;
            if (!mousePos) {
                return;
            }
            const attractRadius = container.retina.attractModeDistance;
            this.processAttract(mousePos, attractRadius, new Circle(mousePos.x, mousePos.y, attractRadius));
        }
        processAttract(position, attractRadius, area) {
            const container = this.container;
            const attractOptions = container.actualOptions.interactivity.modes.attract;
            const query = container.particles.quadTree.query(area);
            for (const particle of query) {
                const { dx, dy, distance } = getDistances(particle.position, position);
                const velocity = attractOptions.speed * attractOptions.factor;
                const attractFactor = clamp(calcEasing(1 - distance / attractRadius, attractOptions.easing) * velocity, 0, attractOptions.maxSpeed);
                const normVec = Vector.create(distance === 0 ? velocity : (dx / distance) * attractFactor, distance === 0 ? velocity : (dy / distance) * attractFactor);
                particle.position.subFrom(normVec);
            }
        }
        clickAttract() {
            const container = this.container;
            if (!container.attract) {
                container.attract = { particles: [] };
            }
            if (!container.attract.finish) {
                if (!container.attract.count) {
                    container.attract.count = 0;
                }
                container.attract.count++;
                if (container.attract.count === container.particles.count) {
                    container.attract.finish = true;
                }
            }
            if (container.attract.clicking) {
                const mousePos = container.interactivity.mouse.clickPosition;
                if (!mousePos) {
                    return;
                }
                const attractRadius = container.retina.attractModeDistance;
                this.processAttract(mousePos, attractRadius, new Circle(mousePos.x, mousePos.y, attractRadius));
            }
            else if (container.attract.clicking === false) {
                container.attract.particles = [];
            }
            return;
        }
    }

    async function loadExternalAttractInteraction(engine) {
        await engine.addInteractor("externalAttract", (container) => new Attractor$1(container));
    }

    class Bouncer extends ExternalInteractorBase {
        constructor(container) {
            super(container);
        }
        isEnabled() {
            const container = this.container, options = container.actualOptions, mouse = container.interactivity.mouse, events = options.interactivity.events, divs = events.onDiv;
            return ((mouse.position && events.onHover.enable && isInArray("bounce", events.onHover.mode)) ||
                isDivModeEnabled("bounce", divs));
        }
        async interact() {
            const container = this.container, options = container.actualOptions, events = options.interactivity.events, mouseMoveStatus = container.interactivity.status === mouseMoveEvent, hoverEnabled = events.onHover.enable, hoverMode = events.onHover.mode, divs = events.onDiv;
            if (mouseMoveStatus && hoverEnabled && isInArray("bounce", hoverMode)) {
                this.processMouseBounce();
            }
            else {
                divModeExecute("bounce", divs, (selector, div) => this.singleSelectorBounce(selector, div));
            }
        }
        reset() {
        }
        processMouseBounce() {
            const container = this.container, pxRatio = container.retina.pixelRatio, tolerance = 10 * pxRatio, mousePos = container.interactivity.mouse.position, radius = container.retina.bounceModeDistance;
            if (mousePos) {
                this.processBounce(mousePos, radius, new Circle(mousePos.x, mousePos.y, radius + tolerance));
            }
        }
        singleSelectorBounce(selector, div) {
            const container = this.container, query = document.querySelectorAll(selector);
            if (!query.length) {
                return;
            }
            query.forEach((item) => {
                const elem = item, pxRatio = container.retina.pixelRatio, pos = {
                    x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
                    y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio,
                }, radius = (elem.offsetWidth / 2) * pxRatio, tolerance = 10 * pxRatio, area = div.type === "circle"
                    ? new Circle(pos.x, pos.y, radius + tolerance)
                    : new Rectangle(elem.offsetLeft * pxRatio - tolerance, elem.offsetTop * pxRatio - tolerance, elem.offsetWidth * pxRatio + tolerance * 2, elem.offsetHeight * pxRatio + tolerance * 2);
                this.processBounce(pos, radius, area);
            });
        }
        processBounce(position, radius, area) {
            const query = this.container.particles.quadTree.query(area);
            for (const particle of query) {
                if (area instanceof Circle) {
                    circleBounce(circleBounceDataFromParticle(particle), {
                        position,
                        radius,
                        mass: (radius ** 2 * Math.PI) / 2,
                        velocity: Vector.origin,
                        factor: Vector.origin,
                    });
                }
                else if (area instanceof Rectangle) {
                    rectBounce(particle, calculateBounds(position, radius));
                }
            }
        }
    }

    async function loadExternalBounceInteraction(engine) {
        await engine.addInteractor("externalBounce", (container) => new Bouncer(container));
    }

    function calculateBubbleValue(particleValue, modeValue, optionsValue, ratio) {
        if (modeValue >= optionsValue) {
            const value = particleValue + (modeValue - optionsValue) * ratio;
            return clamp(value, particleValue, modeValue);
        }
        else if (modeValue < optionsValue) {
            const value = particleValue - (optionsValue - modeValue) * ratio;
            return clamp(value, modeValue, particleValue);
        }
    }
    class Bubbler extends ExternalInteractorBase {
        constructor(container) {
            super(container);
            if (!container.bubble) {
                container.bubble = {};
            }
            this.handleClickMode = (mode) => {
                if (mode !== "bubble") {
                    return;
                }
                if (!container.bubble) {
                    container.bubble = {};
                }
                container.bubble.clicking = true;
            };
        }
        isEnabled() {
            const container = this.container, options = container.actualOptions, mouse = container.interactivity.mouse, events = options.interactivity.events, divs = events.onDiv, divBubble = isDivModeEnabled("bubble", divs);
            if (!(divBubble || (events.onHover.enable && mouse.position) || (events.onClick.enable && mouse.clickPosition))) {
                return false;
            }
            const hoverMode = events.onHover.mode;
            const clickMode = events.onClick.mode;
            return isInArray("bubble", hoverMode) || isInArray("bubble", clickMode) || divBubble;
        }
        reset(particle, force) {
            if (!(!particle.bubble.inRange || force)) {
                return;
            }
            delete particle.bubble.div;
            delete particle.bubble.opacity;
            delete particle.bubble.radius;
            delete particle.bubble.color;
        }
        async interact() {
            const options = this.container.actualOptions, events = options.interactivity.events, onHover = events.onHover, onClick = events.onClick, hoverEnabled = onHover.enable, hoverMode = onHover.mode, clickEnabled = onClick.enable, clickMode = onClick.mode, divs = events.onDiv;
            if (hoverEnabled && isInArray("bubble", hoverMode)) {
                this.hoverBubble();
            }
            else if (clickEnabled && isInArray("bubble", clickMode)) {
                this.clickBubble();
            }
            else {
                divModeExecute("bubble", divs, (selector, div) => this.singleSelectorHover(selector, div));
            }
        }
        singleSelectorHover(selector, div) {
            const container = this.container, selectors = document.querySelectorAll(selector);
            if (!selectors.length) {
                return;
            }
            selectors.forEach((item) => {
                const elem = item, pxRatio = container.retina.pixelRatio, pos = {
                    x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
                    y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio,
                }, repulseRadius = (elem.offsetWidth / 2) * pxRatio, area = div.type === "circle"
                    ? new Circle(pos.x, pos.y, repulseRadius)
                    : new Rectangle(elem.offsetLeft * pxRatio, elem.offsetTop * pxRatio, elem.offsetWidth * pxRatio, elem.offsetHeight * pxRatio), query = container.particles.quadTree.query(area);
                for (const particle of query) {
                    if (!area.contains(particle.getPosition())) {
                        continue;
                    }
                    particle.bubble.inRange = true;
                    const divs = container.actualOptions.interactivity.modes.bubble.divs;
                    const divBubble = divMode(divs, elem);
                    if (!particle.bubble.div || particle.bubble.div !== elem) {
                        this.reset(particle, true);
                        particle.bubble.div = elem;
                    }
                    this.hoverBubbleSize(particle, 1, divBubble);
                    this.hoverBubbleOpacity(particle, 1, divBubble);
                    this.hoverBubbleColor(particle, 1, divBubble);
                }
            });
        }
        process(particle, distMouse, timeSpent, data) {
            const container = this.container, bubbleParam = data.bubbleObj.optValue;
            if (bubbleParam === undefined) {
                return;
            }
            const options = container.actualOptions, bubbleDuration = options.interactivity.modes.bubble.duration, bubbleDistance = container.retina.bubbleModeDistance, particlesParam = data.particlesObj.optValue, pObjBubble = data.bubbleObj.value, pObj = data.particlesObj.value || 0, type = data.type;
            if (bubbleParam === particlesParam) {
                return;
            }
            if (!container.bubble) {
                container.bubble = {};
            }
            if (!container.bubble.durationEnd) {
                if (distMouse <= bubbleDistance) {
                    const obj = pObjBubble !== null && pObjBubble !== void 0 ? pObjBubble : pObj;
                    if (obj !== bubbleParam) {
                        const value = pObj - (timeSpent * (pObj - bubbleParam)) / bubbleDuration;
                        if (type === "size") {
                            particle.bubble.radius = value;
                        }
                        if (type === "opacity") {
                            particle.bubble.opacity = value;
                        }
                    }
                }
                else {
                    if (type === "size") {
                        delete particle.bubble.radius;
                    }
                    if (type === "opacity") {
                        delete particle.bubble.opacity;
                    }
                }
            }
            else if (pObjBubble) {
                if (type === "size") {
                    delete particle.bubble.radius;
                }
                if (type === "opacity") {
                    delete particle.bubble.opacity;
                }
            }
        }
        clickBubble() {
            var _a, _b;
            const container = this.container, options = container.actualOptions, mouseClickPos = container.interactivity.mouse.clickPosition;
            if (!mouseClickPos) {
                return;
            }
            if (!container.bubble) {
                container.bubble = {};
            }
            const distance = container.retina.bubbleModeDistance, query = container.particles.quadTree.queryCircle(mouseClickPos, distance);
            for (const particle of query) {
                if (!container.bubble.clicking) {
                    continue;
                }
                particle.bubble.inRange = !container.bubble.durationEnd;
                const pos = particle.getPosition(), distMouse = getDistance(pos, mouseClickPos), timeSpent = (new Date().getTime() - (container.interactivity.mouse.clickTime || 0)) / 1000;
                if (timeSpent > options.interactivity.modes.bubble.duration) {
                    container.bubble.durationEnd = true;
                }
                if (timeSpent > options.interactivity.modes.bubble.duration * 2) {
                    container.bubble.clicking = false;
                    container.bubble.durationEnd = false;
                }
                const sizeData = {
                    bubbleObj: {
                        optValue: container.retina.bubbleModeSize,
                        value: particle.bubble.radius,
                    },
                    particlesObj: {
                        optValue: getRangeMax(particle.options.size.value) * container.retina.pixelRatio,
                        value: particle.size.value,
                    },
                    type: "size",
                };
                this.process(particle, distMouse, timeSpent, sizeData);
                const opacityData = {
                    bubbleObj: {
                        optValue: options.interactivity.modes.bubble.opacity,
                        value: particle.bubble.opacity,
                    },
                    particlesObj: {
                        optValue: getRangeMax(particle.options.opacity.value),
                        value: (_b = (_a = particle.opacity) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 1,
                    },
                    type: "opacity",
                };
                this.process(particle, distMouse, timeSpent, opacityData);
                if (!container.bubble.durationEnd) {
                    if (distMouse <= container.retina.bubbleModeDistance) {
                        this.hoverBubbleColor(particle, distMouse);
                    }
                    else {
                        delete particle.bubble.color;
                    }
                }
                else {
                    delete particle.bubble.color;
                }
            }
        }
        hoverBubble() {
            const container = this.container, mousePos = container.interactivity.mouse.position;
            if (mousePos === undefined) {
                return;
            }
            const distance = container.retina.bubbleModeDistance, query = container.particles.quadTree.queryCircle(mousePos, distance);
            for (const particle of query) {
                particle.bubble.inRange = true;
                const pos = particle.getPosition(), pointDistance = getDistance(pos, mousePos), ratio = 1 - pointDistance / distance;
                if (pointDistance <= distance) {
                    if (ratio >= 0 && container.interactivity.status === mouseMoveEvent) {
                        this.hoverBubbleSize(particle, ratio);
                        this.hoverBubbleOpacity(particle, ratio);
                        this.hoverBubbleColor(particle, ratio);
                    }
                }
                else {
                    this.reset(particle);
                }
                if (container.interactivity.status === mouseLeaveEvent) {
                    this.reset(particle);
                }
            }
        }
        hoverBubbleSize(particle, ratio, divBubble) {
            const container = this.container, modeSize = (divBubble === null || divBubble === void 0 ? void 0 : divBubble.size) ? divBubble.size * container.retina.pixelRatio : container.retina.bubbleModeSize;
            if (modeSize === undefined) {
                return;
            }
            const optSize = getRangeMax(particle.options.size.value) * container.retina.pixelRatio;
            const pSize = particle.size.value;
            const size = calculateBubbleValue(pSize, modeSize, optSize, ratio);
            if (size !== undefined) {
                particle.bubble.radius = size;
            }
        }
        hoverBubbleOpacity(particle, ratio, divBubble) {
            var _a, _b, _c;
            const container = this.container, options = container.actualOptions, modeOpacity = (_a = divBubble === null || divBubble === void 0 ? void 0 : divBubble.opacity) !== null && _a !== void 0 ? _a : options.interactivity.modes.bubble.opacity;
            if (!modeOpacity) {
                return;
            }
            const optOpacity = particle.options.opacity.value;
            const pOpacity = (_c = (_b = particle.opacity) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : 1;
            const opacity = calculateBubbleValue(pOpacity, modeOpacity, getRangeMax(optOpacity), ratio);
            if (opacity !== undefined) {
                particle.bubble.opacity = opacity;
            }
        }
        hoverBubbleColor(particle, ratio, divBubble) {
            const options = this.container.actualOptions;
            const bubbleOptions = divBubble !== null && divBubble !== void 0 ? divBubble : options.interactivity.modes.bubble;
            if (!particle.bubble.finalColor) {
                const modeColor = bubbleOptions.color;
                if (!modeColor) {
                    return;
                }
                const bubbleColor = modeColor instanceof Array ? itemFromArray(modeColor) : modeColor;
                particle.bubble.finalColor = colorToHsl(bubbleColor);
            }
            if (!particle.bubble.finalColor) {
                return;
            }
            if (bubbleOptions.mix) {
                particle.bubble.color = undefined;
                const pColor = particle.getFillColor();
                particle.bubble.color = pColor
                    ? rgbToHsl(colorMix(pColor, particle.bubble.finalColor, 1 - ratio, ratio))
                    : particle.bubble.finalColor;
            }
            else {
                particle.bubble.color = particle.bubble.finalColor;
            }
        }
    }

    async function loadExternalBubbleInteraction(engine) {
        await engine.addInteractor("externalBubble", (container) => new Bubbler(container));
    }

    class Connector extends ExternalInteractorBase {
        constructor(container) {
            super(container);
        }
        isEnabled() {
            const container = this.container, mouse = container.interactivity.mouse, events = container.actualOptions.interactivity.events;
            if (!(events.onHover.enable && mouse.position)) {
                return false;
            }
            return isInArray("connect", events.onHover.mode);
        }
        reset() {
        }
        async interact() {
            const container = this.container, options = container.actualOptions;
            if (options.interactivity.events.onHover.enable && container.interactivity.status === "mousemove") {
                const mousePos = container.interactivity.mouse.position;
                if (!mousePos) {
                    return;
                }
                const distance = Math.abs(container.retina.connectModeRadius), query = container.particles.quadTree.queryCircle(mousePos, distance);
                let i = 0;
                for (const p1 of query) {
                    const pos1 = p1.getPosition();
                    for (const p2 of query.slice(i + 1)) {
                        const pos2 = p2.getPosition(), distMax = Math.abs(container.retina.connectModeDistance), xDiff = Math.abs(pos1.x - pos2.x), yDiff = Math.abs(pos1.y - pos2.y);
                        if (xDiff < distMax && yDiff < distMax) {
                            container.canvas.drawConnectLine(p1, p2);
                        }
                    }
                    ++i;
                }
            }
        }
    }

    async function loadExternalConnectInteraction(engine) {
        await engine.addInteractor("externalConnect", (container) => new Connector(container));
    }

    class Grabber extends ExternalInteractorBase {
        constructor(container) {
            super(container);
        }
        isEnabled() {
            const container = this.container, mouse = container.interactivity.mouse, events = container.actualOptions.interactivity.events;
            return events.onHover.enable && !!mouse.position && isInArray("grab", events.onHover.mode);
        }
        reset() {
        }
        async interact() {
            var _a;
            const container = this.container, options = container.actualOptions, interactivity = options.interactivity;
            if (!interactivity.events.onHover.enable || container.interactivity.status !== mouseMoveEvent) {
                return;
            }
            const mousePos = container.interactivity.mouse.position;
            if (!mousePos) {
                return;
            }
            const distance = container.retina.grabModeDistance, query = container.particles.quadTree.queryCircle(mousePos, distance);
            for (const particle of query) {
                const pos = particle.getPosition(), pointDistance = getDistance(pos, mousePos);
                if (pointDistance > distance) {
                    continue;
                }
                const grabLineOptions = interactivity.modes.grab.links, lineOpacity = grabLineOptions.opacity, opacityLine = lineOpacity - (pointDistance * lineOpacity) / distance;
                if (opacityLine <= 0) {
                    continue;
                }
                const optColor = (_a = grabLineOptions.color) !== null && _a !== void 0 ? _a : particle.options.links.color;
                if (!container.particles.grabLineColor) {
                    const linksOptions = options.interactivity.modes.grab.links;
                    container.particles.grabLineColor = getLinkRandomColor(optColor, linksOptions.blink, linksOptions.consent);
                }
                const colorLine = getLinkColor(particle, undefined, container.particles.grabLineColor);
                if (!colorLine) {
                    return;
                }
                container.canvas.drawGrabLine(particle, colorLine, opacityLine, mousePos);
            }
        }
    }

    async function loadExternalGrabInteraction(engine) {
        await engine.addInteractor("externalGrab", (container) => new Grabber(container));
    }

    class Pauser extends ExternalInteractorBase {
        constructor(container) {
            super(container);
            this.handleClickMode = (mode) => {
                if (mode !== "pause") {
                    return;
                }
                const container = this.container;
                if (container.getAnimationStatus()) {
                    container.pause();
                }
                else {
                    container.play();
                }
            };
        }
        isEnabled() {
            return true;
        }
        reset() {
        }
        async interact() {
        }
    }

    function loadExternalPauseInteraction(engine) {
        engine.addInteractor("externalPause", (container) => new Pauser(container));
    }

    class Pusher extends ExternalInteractorBase {
        constructor(container) {
            super(container);
            this.handleClickMode = (mode) => {
                if (mode !== "push") {
                    return;
                }
                const container = this.container;
                const options = container.actualOptions;
                const pushNb = options.interactivity.modes.push.quantity;
                if (pushNb <= 0) {
                    return;
                }
                const pushOptions = options.interactivity.modes.push;
                const group = itemFromArray([undefined, ...pushOptions.groups]);
                const groupOptions = group !== undefined ? container.actualOptions.particles.groups[group] : undefined;
                container.particles.push(pushNb, container.interactivity.mouse, groupOptions, group);
            };
        }
        isEnabled() {
            return true;
        }
        reset() {
        }
        async interact() {
        }
    }

    async function loadExternalPushInteraction(engine) {
        await engine.addInteractor("externalPush", (container) => new Pusher(container));
    }

    class Remover extends ExternalInteractorBase {
        constructor(container) {
            super(container);
            this.handleClickMode = (mode) => {
                if (mode !== "remove") {
                    return;
                }
                const container = this.container;
                const options = container.actualOptions;
                const removeNb = options.interactivity.modes.remove.quantity;
                container.particles.removeQuantity(removeNb);
            };
        }
        isEnabled() {
            return true;
        }
        reset() {
        }
        async interact() {
        }
    }

    function loadExternalRemoveInteraction(engine) {
        engine.addInteractor("externalRemove", (container) => new Remover(container));
    }

    class Repulser extends ExternalInteractorBase {
        constructor(container) {
            super(container);
            if (!container.repulse) {
                container.repulse = { particles: [] };
            }
            this.handleClickMode = (mode) => {
                const options = this.container.actualOptions;
                if (mode !== "repulse") {
                    return;
                }
                if (!container.repulse) {
                    container.repulse = { particles: [] };
                }
                container.repulse.clicking = true;
                container.repulse.count = 0;
                for (const particle of container.repulse.particles) {
                    particle.velocity.setTo(particle.initialVelocity);
                }
                container.repulse.particles = [];
                container.repulse.finish = false;
                setTimeout(() => {
                    if (!container.destroyed) {
                        if (!container.repulse) {
                            container.repulse = { particles: [] };
                        }
                        container.repulse.clicking = false;
                    }
                }, options.interactivity.modes.repulse.duration * 1000);
            };
        }
        isEnabled() {
            const container = this.container, options = container.actualOptions, mouse = container.interactivity.mouse, events = options.interactivity.events, divs = events.onDiv, divRepulse = isDivModeEnabled("repulse", divs);
            if (!(divRepulse || (events.onHover.enable && mouse.position) || (events.onClick.enable && mouse.clickPosition))) {
                return false;
            }
            const hoverMode = events.onHover.mode, clickMode = events.onClick.mode;
            return isInArray("repulse", hoverMode) || isInArray("repulse", clickMode) || divRepulse;
        }
        reset() {
        }
        async interact() {
            const container = this.container, options = container.actualOptions, mouseMoveStatus = container.interactivity.status === mouseMoveEvent, events = options.interactivity.events, hoverEnabled = events.onHover.enable, hoverMode = events.onHover.mode, clickEnabled = events.onClick.enable, clickMode = events.onClick.mode, divs = events.onDiv;
            if (mouseMoveStatus && hoverEnabled && isInArray("repulse", hoverMode)) {
                this.hoverRepulse();
            }
            else if (clickEnabled && isInArray("repulse", clickMode)) {
                this.clickRepulse();
            }
            else {
                divModeExecute("repulse", divs, (selector, div) => this.singleSelectorRepulse(selector, div));
            }
        }
        singleSelectorRepulse(selector, div) {
            const container = this.container, query = document.querySelectorAll(selector);
            if (!query.length) {
                return;
            }
            query.forEach((item) => {
                const elem = item, pxRatio = container.retina.pixelRatio, pos = {
                    x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
                    y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio,
                }, repulseRadius = (elem.offsetWidth / 2) * pxRatio, area = div.type === "circle"
                    ? new Circle(pos.x, pos.y, repulseRadius)
                    : new Rectangle(elem.offsetLeft * pxRatio, elem.offsetTop * pxRatio, elem.offsetWidth * pxRatio, elem.offsetHeight * pxRatio), divs = container.actualOptions.interactivity.modes.repulse.divs, divRepulse = divMode(divs, elem);
                this.processRepulse(pos, repulseRadius, area, divRepulse);
            });
        }
        hoverRepulse() {
            const container = this.container, mousePos = container.interactivity.mouse.position;
            if (!mousePos) {
                return;
            }
            const repulseRadius = container.retina.repulseModeDistance;
            this.processRepulse(mousePos, repulseRadius, new Circle(mousePos.x, mousePos.y, repulseRadius));
        }
        processRepulse(position, repulseRadius, area, divRepulse) {
            var _a;
            const container = this.container, query = container.particles.quadTree.query(area), repulseOptions = container.actualOptions.interactivity.modes.repulse;
            for (const particle of query) {
                const { dx, dy, distance } = getDistances(particle.position, position), velocity = ((_a = divRepulse === null || divRepulse === void 0 ? void 0 : divRepulse.speed) !== null && _a !== void 0 ? _a : repulseOptions.speed) * repulseOptions.factor, repulseFactor = clamp(calcEasing(1 - distance / repulseRadius, repulseOptions.easing) * velocity, 0, repulseOptions.maxSpeed), normVec = Vector.create(distance === 0 ? velocity : (dx / distance) * repulseFactor, distance === 0 ? velocity : (dy / distance) * repulseFactor);
                particle.position.addTo(normVec);
            }
        }
        clickRepulse() {
            const container = this.container;
            if (!container.repulse) {
                container.repulse = { particles: [] };
            }
            if (!container.repulse.finish) {
                if (!container.repulse.count) {
                    container.repulse.count = 0;
                }
                container.repulse.count++;
                if (container.repulse.count === container.particles.count) {
                    container.repulse.finish = true;
                }
            }
            if (container.repulse.clicking) {
                const repulseDistance = container.retina.repulseModeDistance, repulseRadius = Math.pow(repulseDistance / 6, 3), mouseClickPos = container.interactivity.mouse.clickPosition;
                if (mouseClickPos === undefined) {
                    return;
                }
                const range = new Circle(mouseClickPos.x, mouseClickPos.y, repulseRadius), query = container.particles.quadTree.query(range);
                for (const particle of query) {
                    const { dx, dy, distance } = getDistances(mouseClickPos, particle.position), d = distance ** 2, velocity = container.actualOptions.interactivity.modes.repulse.speed, force = (-repulseRadius * velocity) / d;
                    if (d <= repulseRadius) {
                        container.repulse.particles.push(particle);
                        const vect = Vector.create(dx, dy);
                        vect.length = force;
                        particle.velocity.setTo(vect);
                    }
                }
            }
            else if (container.repulse.clicking === false) {
                for (const particle of container.repulse.particles) {
                    particle.velocity.setTo(particle.initialVelocity);
                }
                container.repulse.particles = [];
            }
        }
    }

    async function loadExternalRepulseInteraction(engine) {
        await engine.addInteractor("externalRepulse", (container) => new Repulser(container));
    }

    const currentColorRegex = /(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\((-?\d+%?[,\s]+){2,3}\s*[\d.]+%?\))|currentcolor/gi;
    function replaceColorSvg(imageShape, color, opacity) {
        const { svgData } = imageShape;
        if (!svgData) {
            return "";
        }
        const colorStyle = getStyleFromHsl(color, opacity);
        if (svgData.includes("fill")) {
            return svgData.replace(currentColorRegex, () => colorStyle);
        }
        const preFillIndex = svgData.indexOf(">");
        return `${svgData.substring(0, preFillIndex)} fill="${colorStyle}"${svgData.substring(preFillIndex)}`;
    }
    async function loadImage(image) {
        return new Promise((resolve) => {
            image.loading = true;
            const img = new Image();
            img.addEventListener("load", () => {
                image.element = img;
                image.loading = false;
                resolve();
            });
            img.addEventListener("error", () => {
                image.error = true;
                image.loading = false;
                console.error(`Error tsParticles - loading image: ${image.source}`);
                resolve();
            });
            img.src = image.source;
        });
    }
    async function downloadSvgImage(image) {
        if (image.type !== "svg") {
            await loadImage(image);
            return;
        }
        image.loading = true;
        const response = await fetch(image.source);
        image.loading = false;
        if (!response.ok) {
            console.error("Error tsParticles - Image not found");
            image.error = true;
        }
        if (!image.error) {
            image.svgData = await response.text();
        }
    }
    function replaceImageColor(image, imageData, color, particle) {
        var _a, _b, _c;
        const svgColoredData = replaceColorSvg(image, color, (_b = (_a = particle.opacity) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 1);
        const svg = new Blob([svgColoredData], { type: "image/svg+xml" });
        const domUrl = URL || window.URL || window.webkitURL || window;
        const url = domUrl.createObjectURL(svg);
        const img = new Image();
        const imageRes = {
            data: Object.assign(Object.assign({}, image), { svgData: svgColoredData }),
            ratio: imageData.width / imageData.height,
            replaceColor: (_c = imageData.replaceColor) !== null && _c !== void 0 ? _c : imageData.replace_color,
            source: imageData.src,
        };
        img.addEventListener("load", () => {
            const pImage = particle.image;
            if (pImage) {
                pImage.loaded = true;
                image.element = img;
            }
            domUrl.revokeObjectURL(url);
        });
        img.addEventListener("error", () => {
            domUrl.revokeObjectURL(url);
            const img2 = Object.assign(Object.assign({}, image), { error: false, loading: true });
            loadImage(img2).then(() => {
                const pImage = particle.image;
                if (pImage) {
                    image.element = img2.element;
                    pImage.loaded = true;
                }
            });
        });
        img.src = url;
        return imageRes;
    }

    var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };
    var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _ImageDrawer_images;
    class ImageDrawer {
        constructor() {
            _ImageDrawer_images.set(this, void 0);
            __classPrivateFieldSet(this, _ImageDrawer_images, [], "f");
        }
        getSidesCount() {
            return 12;
        }
        getImages(container) {
            const containerImages = __classPrivateFieldGet(this, _ImageDrawer_images, "f").find((t) => t.id === container.id);
            if (!containerImages) {
                __classPrivateFieldGet(this, _ImageDrawer_images, "f").push({
                    id: container.id,
                    images: [],
                });
                return this.getImages(container);
            }
            else {
                return containerImages;
            }
        }
        addImage(container, image) {
            const containerImages = this.getImages(container);
            containerImages === null || containerImages === void 0 ? void 0 : containerImages.images.push(image);
        }
        destroy() {
            __classPrivateFieldSet(this, _ImageDrawer_images, [], "f");
        }
        draw(context, particle, radius, opacity) {
            var _a, _b;
            const image = particle.image;
            const element = (_a = image === null || image === void 0 ? void 0 : image.data) === null || _a === void 0 ? void 0 : _a.element;
            if (!element) {
                return;
            }
            const ratio = (_b = image === null || image === void 0 ? void 0 : image.ratio) !== null && _b !== void 0 ? _b : 1;
            const pos = {
                x: -radius,
                y: -radius,
            };
            if (!(image === null || image === void 0 ? void 0 : image.data.svgData) || !(image === null || image === void 0 ? void 0 : image.replaceColor)) {
                context.globalAlpha = opacity;
            }
            context.drawImage(element, pos.x, pos.y, radius * 2, (radius * 2) / ratio);
            if (!(image === null || image === void 0 ? void 0 : image.data.svgData) || !(image === null || image === void 0 ? void 0 : image.replaceColor)) {
                context.globalAlpha = 1;
            }
        }
        loadShape(particle) {
            var _a, _b, _c;
            if (particle.shape !== "image" && particle.shape !== "images") {
                return;
            }
            const images = this.getImages(particle.container).images;
            const imageData = particle.shapeData;
            const image = images.find((t) => t.source === imageData.src);
            let imageRes;
            if (!image) {
                this.loadImageShape(particle.container, imageData).then(() => {
                    this.loadShape(particle);
                });
                return;
            }
            if (image.error) {
                return;
            }
            const color = particle.getFillColor();
            if (image.svgData && imageData.replaceColor && color) {
                imageRes = replaceImageColor(image, imageData, color, particle);
            }
            else {
                imageRes = {
                    data: image,
                    loaded: true,
                    ratio: imageData.width / imageData.height,
                    replaceColor: (_a = imageData.replaceColor) !== null && _a !== void 0 ? _a : imageData.replace_color,
                    source: imageData.src,
                };
            }
            if (!imageRes.ratio) {
                imageRes.ratio = 1;
            }
            const fill = (_b = imageData.fill) !== null && _b !== void 0 ? _b : particle.fill;
            const close = (_c = imageData.close) !== null && _c !== void 0 ? _c : particle.close;
            const imageShape = {
                image: imageRes,
                fill,
                close,
            };
            particle.image = imageShape.image;
            particle.fill = imageShape.fill;
            particle.close = imageShape.close;
        }
        async loadImageShape(container, imageShape) {
            const source = imageShape.src;
            if (!source) {
                throw new Error("Error tsParticles - No image.src");
            }
            try {
                const image = {
                    source: source,
                    type: source.substr(source.length - 3),
                    error: false,
                    loading: true,
                };
                this.addImage(container, image);
                const imageFunc = imageShape.replaceColor ? downloadSvgImage : loadImage;
                await imageFunc(image);
            }
            catch (_a) {
                throw new Error(`tsParticles error - ${imageShape.src} not found`);
            }
        }
    }
    _ImageDrawer_images = new WeakMap();

    async function loadImageShape(engine) {
        const imageDrawer = new ImageDrawer();
        await engine.addShape("image", imageDrawer);
        await engine.addShape("images", imageDrawer);
    }

    class LifeUpdater {
        constructor(container) {
            this.container = container;
        }
        init() {
        }
        isEnabled(particle) {
            return !particle.destroyed;
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            const life = particle.life;
            let justSpawned = false;
            if (particle.spawning) {
                life.delayTime += delta.value;
                if (life.delayTime >= particle.life.delay) {
                    justSpawned = true;
                    particle.spawning = false;
                    life.delayTime = 0;
                    life.time = 0;
                }
                else {
                    return;
                }
            }
            if (life.duration === -1) {
                return;
            }
            if (particle.spawning) {
                return;
            }
            if (justSpawned) {
                life.time = 0;
            }
            else {
                life.time += delta.value;
            }
            if (life.time < life.duration) {
                return;
            }
            life.time = 0;
            if (particle.life.count > 0) {
                particle.life.count--;
            }
            if (particle.life.count === 0) {
                particle.destroy();
                return;
            }
            const canvasSize = this.container.canvas.size, widthRange = setRangeValue(0, canvasSize.width), heightRange = setRangeValue(0, canvasSize.width);
            particle.position.x = randomInRange(widthRange);
            particle.position.y = randomInRange(heightRange);
            particle.spawning = true;
            life.delayTime = 0;
            life.time = 0;
            particle.reset();
            const lifeOptions = particle.options.life;
            life.delay = getRangeValue(lifeOptions.delay.value) * 1000;
            life.duration = getRangeValue(lifeOptions.duration.value) * 1000;
        }
    }

    async function loadLifeUpdater(engine) {
        await engine.addParticleUpdater("life", (container) => new LifeUpdater(container));
    }

    class LineDrawer {
        getSidesCount() {
            return 1;
        }
        draw(context, particle, radius) {
            context.moveTo(-radius / 2, 0);
            context.lineTo(radius / 2, 0);
        }
    }

    async function loadLineShape(engine) {
        await engine.addShape("line", new LineDrawer());
    }

    function checkDestroy$1(particle, value, minValue, maxValue) {
        switch (particle.options.opacity.animation.destroy) {
            case "max":
                if (value >= maxValue) {
                    particle.destroy();
                }
                break;
            case "min":
                if (value <= minValue) {
                    particle.destroy();
                }
                break;
        }
    }
    function updateOpacity(particle, delta) {
        var _a, _b, _c, _d, _e;
        if (!particle.opacity) {
            return;
        }
        const minValue = particle.opacity.min;
        const maxValue = particle.opacity.max;
        if (particle.destroyed ||
            !particle.opacity.enable ||
            (((_a = particle.opacity.maxLoops) !== null && _a !== void 0 ? _a : 0) > 0 && ((_b = particle.opacity.loops) !== null && _b !== void 0 ? _b : 0) > ((_c = particle.opacity.maxLoops) !== null && _c !== void 0 ? _c : 0))) {
            return;
        }
        switch (particle.opacity.status) {
            case 0:
                if (particle.opacity.value >= maxValue) {
                    particle.opacity.status = 1;
                    if (!particle.opacity.loops) {
                        particle.opacity.loops = 0;
                    }
                    particle.opacity.loops++;
                }
                else {
                    particle.opacity.value += ((_d = particle.opacity.velocity) !== null && _d !== void 0 ? _d : 0) * delta.factor;
                }
                break;
            case 1:
                if (particle.opacity.value <= minValue) {
                    particle.opacity.status = 0;
                    if (!particle.opacity.loops) {
                        particle.opacity.loops = 0;
                    }
                    particle.opacity.loops++;
                }
                else {
                    particle.opacity.value -= ((_e = particle.opacity.velocity) !== null && _e !== void 0 ? _e : 0) * delta.factor;
                }
                break;
        }
        checkDestroy$1(particle, particle.opacity.value, minValue, maxValue);
        if (!particle.destroyed) {
            particle.opacity.value = clamp(particle.opacity.value, minValue, maxValue);
        }
    }
    class OpacityUpdater {
        constructor(container) {
            this.container = container;
        }
        init(particle) {
            const opacityOptions = particle.options.opacity;
            particle.opacity = {
                enable: opacityOptions.animation.enable,
                max: getRangeMax(opacityOptions.value),
                min: getRangeMin(opacityOptions.value),
                value: getRangeValue(opacityOptions.value),
                loops: 0,
                maxLoops: getRangeValue(opacityOptions.animation.count),
            };
            const opacityAnimation = opacityOptions.animation;
            if (opacityAnimation.enable) {
                particle.opacity.status = 0;
                const opacityRange = opacityOptions.value;
                particle.opacity.min = getRangeMin(opacityRange);
                particle.opacity.max = getRangeMax(opacityRange);
                switch (opacityAnimation.startValue) {
                    case "min":
                        particle.opacity.value = particle.opacity.min;
                        particle.opacity.status = 0;
                        break;
                    case "random":
                        particle.opacity.value = randomInRange(particle.opacity);
                        particle.opacity.status =
                            Math.random() >= 0.5 ? 0 : 1;
                        break;
                    case "max":
                    default:
                        particle.opacity.value = particle.opacity.max;
                        particle.opacity.status = 1;
                        break;
                }
                particle.opacity.velocity =
                    (getRangeValue(opacityAnimation.speed) / 100) * this.container.retina.reduceFactor;
                if (!opacityAnimation.sync) {
                    particle.opacity.velocity *= Math.random();
                }
            }
        }
        isEnabled(particle) {
            var _a, _b, _c, _d;
            return (!particle.destroyed &&
                !particle.spawning &&
                !!particle.opacity &&
                particle.opacity.enable &&
                (((_a = particle.opacity.maxLoops) !== null && _a !== void 0 ? _a : 0) <= 0 ||
                    (((_b = particle.opacity.maxLoops) !== null && _b !== void 0 ? _b : 0) > 0 &&
                        ((_c = particle.opacity.loops) !== null && _c !== void 0 ? _c : 0) < ((_d = particle.opacity.maxLoops) !== null && _d !== void 0 ? _d : 0))));
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            updateOpacity(particle, delta);
        }
    }

    async function loadOpacityUpdater(engine) {
        await engine.addParticleUpdater("opacity", (container) => new OpacityUpdater(container));
    }

    function bounceHorizontal(data) {
        if (!(data.outMode === "bounce" ||
            data.outMode === "bounce-horizontal" ||
            data.outMode === "bounceHorizontal" ||
            data.outMode === "split")) {
            return;
        }
        const velocity = data.particle.velocity.x;
        let bounced = false;
        if ((data.direction === "right" && data.bounds.right >= data.canvasSize.width && velocity > 0) ||
            (data.direction === "left" && data.bounds.left <= 0 && velocity < 0)) {
            const newVelocity = getValue(data.particle.options.bounce.horizontal);
            data.particle.velocity.x *= -newVelocity;
            bounced = true;
        }
        if (!bounced) {
            return;
        }
        const minPos = data.offset.x + data.size;
        if (data.bounds.right >= data.canvasSize.width) {
            data.particle.position.x = data.canvasSize.width - minPos;
        }
        else if (data.bounds.left <= 0) {
            data.particle.position.x = minPos;
        }
        if (data.outMode === "split") {
            data.particle.destroy();
        }
    }
    function bounceVertical(data) {
        if (data.outMode === "bounce" ||
            data.outMode === "bounce-vertical" ||
            data.outMode === "bounceVertical" ||
            data.outMode === "split") {
            const velocity = data.particle.velocity.y;
            let bounced = false;
            if ((data.direction === "bottom" &&
                data.bounds.bottom >= data.canvasSize.height &&
                velocity > 0) ||
                (data.direction === "top" && data.bounds.top <= 0 && velocity < 0)) {
                const newVelocity = getValue(data.particle.options.bounce.vertical);
                data.particle.velocity.y *= -newVelocity;
                bounced = true;
            }
            if (!bounced) {
                return;
            }
            const minPos = data.offset.y + data.size;
            if (data.bounds.bottom >= data.canvasSize.height) {
                data.particle.position.y = data.canvasSize.height - minPos;
            }
            else if (data.bounds.top <= 0) {
                data.particle.position.y = minPos;
            }
            if (data.outMode === "split") {
                data.particle.destroy();
            }
        }
    }

    class BounceOutMode {
        constructor(container) {
            this.container = container;
            this.modes = [
                "bounce",
                "bounce-vertical",
                "bounce-horizontal",
                "bounceVertical",
                "bounceHorizontal",
                "split",
            ];
        }
        update(particle, direction, delta, outMode) {
            if (!this.modes.includes(outMode)) {
                return;
            }
            const container = this.container;
            let handled = false;
            for (const [, plugin] of container.plugins) {
                if (plugin.particleBounce !== undefined) {
                    handled = plugin.particleBounce(particle, delta, direction);
                }
                if (handled) {
                    break;
                }
            }
            if (handled) {
                return;
            }
            const pos = particle.getPosition(), offset = particle.offset, size = particle.getRadius(), bounds = calculateBounds(pos, size), canvasSize = container.canvas.size;
            bounceHorizontal({ particle, outMode, direction, bounds, canvasSize, offset, size });
            bounceVertical({ particle, outMode, direction, bounds, canvasSize, offset, size });
        }
    }

    class DestroyOutMode {
        constructor(container) {
            this.container = container;
            this.modes = ["destroy"];
        }
        update(particle, direction, delta, outMode) {
            if (!this.modes.includes(outMode)) {
                return;
            }
            const container = this.container;
            switch (particle.outType) {
                case "normal":
                case "outside":
                    if (isPointInside(particle.position, container.canvas.size, Vector.origin, particle.getRadius(), direction)) {
                        return;
                    }
                    break;
                case "inside": {
                    const { dx, dy } = getDistances(particle.position, particle.moveCenter);
                    const { x: vx, y: vy } = particle.velocity;
                    if ((vx < 0 && dx > particle.moveCenter.radius) ||
                        (vy < 0 && dy > particle.moveCenter.radius) ||
                        (vx >= 0 && dx < -particle.moveCenter.radius) ||
                        (vy >= 0 && dy < -particle.moveCenter.radius)) {
                        return;
                    }
                    break;
                }
            }
            container.particles.remove(particle, undefined, true);
        }
    }

    class NoneOutMode {
        constructor(container) {
            this.container = container;
            this.modes = ["none"];
        }
        update(particle, direction, delta, outMode) {
            if (!this.modes.includes(outMode)) {
                return;
            }
            if ((particle.options.move.distance.horizontal &&
                (direction === "left" || direction === "right")) ||
                (particle.options.move.distance.vertical &&
                    (direction === "top" || direction === "bottom"))) {
                return;
            }
            const gravityOptions = particle.options.move.gravity, container = this.container;
            const canvasSize = container.canvas.size;
            const pRadius = particle.getRadius();
            if (!gravityOptions.enable) {
                if ((particle.velocity.y > 0 && particle.position.y <= canvasSize.height + pRadius) ||
                    (particle.velocity.y < 0 && particle.position.y >= -pRadius) ||
                    (particle.velocity.x > 0 && particle.position.x <= canvasSize.width + pRadius) ||
                    (particle.velocity.x < 0 && particle.position.x >= -pRadius)) {
                    return;
                }
                if (!isPointInside(particle.position, container.canvas.size, Vector.origin, pRadius, direction)) {
                    container.particles.remove(particle);
                }
            }
            else {
                const position = particle.position;
                if ((!gravityOptions.inverse &&
                    position.y > canvasSize.height + pRadius &&
                    direction === "bottom") ||
                    (gravityOptions.inverse && position.y < -pRadius && direction === "top")) {
                    container.particles.remove(particle);
                }
            }
        }
    }

    class OutOutMode {
        constructor(container) {
            this.container = container;
            this.modes = ["out"];
        }
        update(particle, direction, delta, outMode) {
            if (!this.modes.includes(outMode)) {
                return;
            }
            const container = this.container;
            switch (particle.outType) {
                case "inside": {
                    const { x: vx, y: vy } = particle.velocity;
                    const circVec = Vector.origin;
                    circVec.length = particle.moveCenter.radius;
                    circVec.angle = particle.velocity.angle + Math.PI;
                    circVec.addTo(Vector.create(particle.moveCenter));
                    const { dx, dy } = getDistances(particle.position, circVec);
                    if ((vx <= 0 && dx >= 0) || (vy <= 0 && dy >= 0) || (vx >= 0 && dx <= 0) || (vy >= 0 && dy <= 0)) {
                        return;
                    }
                    particle.position.x = Math.floor(randomInRange({
                        min: 0,
                        max: container.canvas.size.width,
                    }));
                    particle.position.y = Math.floor(randomInRange({
                        min: 0,
                        max: container.canvas.size.height,
                    }));
                    const { dx: newDx, dy: newDy } = getDistances(particle.position, particle.moveCenter);
                    particle.direction = Math.atan2(-newDy, -newDx);
                    particle.velocity.angle = particle.direction;
                    break;
                }
                default: {
                    if (isPointInside(particle.position, container.canvas.size, Vector.origin, particle.getRadius(), direction)) {
                        return;
                    }
                    switch (particle.outType) {
                        case "outside": {
                            particle.position.x =
                                Math.floor(randomInRange({
                                    min: -particle.moveCenter.radius,
                                    max: particle.moveCenter.radius,
                                })) + particle.moveCenter.x;
                            particle.position.y =
                                Math.floor(randomInRange({
                                    min: -particle.moveCenter.radius,
                                    max: particle.moveCenter.radius,
                                })) + particle.moveCenter.y;
                            const { dx, dy } = getDistances(particle.position, particle.moveCenter);
                            if (particle.moveCenter.radius) {
                                particle.direction = Math.atan2(dy, dx);
                                particle.velocity.angle = particle.direction;
                            }
                            break;
                        }
                        case "normal": {
                            const wrap = particle.options.move.warp, canvasSize = container.canvas.size, newPos = {
                                bottom: canvasSize.height + particle.getRadius() + particle.offset.y,
                                left: -particle.getRadius() - particle.offset.x,
                                right: canvasSize.width + particle.getRadius() + particle.offset.x,
                                top: -particle.getRadius() - particle.offset.y,
                            }, sizeValue = particle.getRadius(), nextBounds = calculateBounds(particle.position, sizeValue);
                            if (direction === "right" &&
                                nextBounds.left > canvasSize.width + particle.offset.x) {
                                particle.position.x = newPos.left;
                                particle.initialPosition.x = particle.position.x;
                                if (!wrap) {
                                    particle.position.y = Math.random() * canvasSize.height;
                                    particle.initialPosition.y = particle.position.y;
                                }
                            }
                            else if (direction === "left" && nextBounds.right < -particle.offset.x) {
                                particle.position.x = newPos.right;
                                particle.initialPosition.x = particle.position.x;
                                if (!wrap) {
                                    particle.position.y = Math.random() * canvasSize.height;
                                    particle.initialPosition.y = particle.position.y;
                                }
                            }
                            if (direction === "bottom" &&
                                nextBounds.top > canvasSize.height + particle.offset.y) {
                                if (!wrap) {
                                    particle.position.x = Math.random() * canvasSize.width;
                                    particle.initialPosition.x = particle.position.x;
                                }
                                particle.position.y = newPos.top;
                                particle.initialPosition.y = particle.position.y;
                            }
                            else if (direction === "top" && nextBounds.bottom < -particle.offset.y) {
                                if (!wrap) {
                                    particle.position.x = Math.random() * canvasSize.width;
                                    particle.initialPosition.x = particle.position.x;
                                }
                                particle.position.y = newPos.bottom;
                                particle.initialPosition.y = particle.position.y;
                            }
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }

    class OutOfCanvasUpdater {
        constructor(container) {
            this.container = container;
            this.updaters = [
                new BounceOutMode(container),
                new DestroyOutMode(container),
                new OutOutMode(container),
                new NoneOutMode(container),
            ];
        }
        init() {
        }
        isEnabled(particle) {
            return !particle.destroyed && !particle.spawning;
        }
        update(particle, delta) {
            var _a, _b, _c, _d;
            const outModes = particle.options.move.outModes;
            this.updateOutMode(particle, delta, (_a = outModes.bottom) !== null && _a !== void 0 ? _a : outModes.default, "bottom");
            this.updateOutMode(particle, delta, (_b = outModes.left) !== null && _b !== void 0 ? _b : outModes.default, "left");
            this.updateOutMode(particle, delta, (_c = outModes.right) !== null && _c !== void 0 ? _c : outModes.default, "right");
            this.updateOutMode(particle, delta, (_d = outModes.top) !== null && _d !== void 0 ? _d : outModes.default, "top");
        }
        updateOutMode(particle, delta, outMode, direction) {
            for (const updater of this.updaters) {
                updater.update(particle, direction, delta, outMode);
            }
        }
    }

    async function loadOutModesUpdater(engine) {
        await engine.addParticleUpdater("outModes", (container) => new OutOfCanvasUpdater(container));
    }

    class ParallaxMover {
        init() {
        }
        isEnabled(particle) {
            return (!isSsr() &&
                !particle.destroyed &&
                particle.container.actualOptions.interactivity.events.onHover.parallax.enable);
        }
        move(particle) {
            const container = particle.container, options = container.actualOptions;
            if (isSsr() || !options.interactivity.events.onHover.parallax.enable) {
                return;
            }
            const parallaxForce = options.interactivity.events.onHover.parallax.force, mousePos = container.interactivity.mouse.position;
            if (!mousePos) {
                return;
            }
            const canvasCenter = {
                x: container.canvas.size.width / 2,
                y: container.canvas.size.height / 2,
            }, parallaxSmooth = options.interactivity.events.onHover.parallax.smooth, factor = particle.getRadius() / parallaxForce, centerDistance = {
                x: (mousePos.x - canvasCenter.x) * factor,
                y: (mousePos.y - canvasCenter.y) * factor,
            };
            particle.offset.x += (centerDistance.x - particle.offset.x) / parallaxSmooth;
            particle.offset.y += (centerDistance.y - particle.offset.y) / parallaxSmooth;
        }
    }

    async function loadParallaxMover(engine) {
        engine.addMover("parallax", () => new ParallaxMover());
    }

    class Attractor extends ParticlesInteractorBase {
        constructor(container) {
            super(container);
        }
        async interact(p1) {
            var _a;
            const container = this.container, distance = (_a = p1.retina.attractDistance) !== null && _a !== void 0 ? _a : container.retina.attractDistance, pos1 = p1.getPosition(), query = container.particles.quadTree.queryCircle(pos1, distance);
            for (const p2 of query) {
                if (p1 === p2 || !p2.options.move.attract.enable || p2.destroyed || p2.spawning) {
                    continue;
                }
                const pos2 = p2.getPosition(), { dx, dy } = getDistances(pos1, pos2), rotate = p1.options.move.attract.rotate, ax = dx / (rotate.x * 1000), ay = dy / (rotate.y * 1000), p1Factor = p2.size.value / p1.size.value, p2Factor = 1 / p1Factor;
                p1.velocity.x -= ax * p1Factor;
                p1.velocity.y -= ay * p1Factor;
                p2.velocity.x += ax * p2Factor;
                p2.velocity.y += ay * p2Factor;
            }
        }
        isEnabled(particle) {
            return particle.options.move.attract.enable;
        }
        reset() {
        }
    }

    async function loadParticlesAttractInteraction(engine) {
        await engine.addInteractor("particlesAttract", (container) => new Attractor(container));
    }

    function absorb(p1, p2, fps, pixelRatio) {
        if (p1.getRadius() === undefined && p2.getRadius() !== undefined) {
            p1.destroy();
        }
        else if (p1.getRadius() !== undefined && p2.getRadius() === undefined) {
            p2.destroy();
        }
        else if (p1.getRadius() !== undefined && p2.getRadius() !== undefined) {
            if (p1.getRadius() >= p2.getRadius()) {
                const factor = clamp(p1.getRadius() / p2.getRadius(), 0, p2.getRadius()) * fps;
                p1.size.value += factor;
                p2.size.value -= factor;
                if (p2.getRadius() <= pixelRatio) {
                    p2.size.value = 0;
                    p2.destroy();
                }
            }
            else {
                const factor = clamp(p2.getRadius() / p1.getRadius(), 0, p1.getRadius()) * fps;
                p1.size.value -= factor;
                p2.size.value += factor;
                if (p1.getRadius() <= pixelRatio) {
                    p1.size.value = 0;
                    p1.destroy();
                }
            }
        }
    }

    function bounce(p1, p2) {
        circleBounce(circleBounceDataFromParticle(p1), circleBounceDataFromParticle(p2));
    }

    function destroy(p1, p2) {
        if (!p1.unbreakable && !p2.unbreakable) {
            bounce(p1, p2);
        }
        if (p1.getRadius() === undefined && p2.getRadius() !== undefined) {
            p1.destroy();
        }
        else if (p1.getRadius() !== undefined && p2.getRadius() === undefined) {
            p2.destroy();
        }
        else if (p1.getRadius() !== undefined && p2.getRadius() !== undefined) {
            if (p1.getRadius() >= p2.getRadius()) {
                p2.destroy();
            }
            else {
                p1.destroy();
            }
        }
    }

    function resolveCollision(p1, p2, fps, pixelRatio) {
        switch (p1.options.collisions.mode) {
            case "absorb": {
                absorb(p1, p2, fps, pixelRatio);
                break;
            }
            case "bounce": {
                bounce(p1, p2);
                break;
            }
            case "destroy": {
                destroy(p1, p2);
                break;
            }
        }
    }

    class Collider extends ParticlesInteractorBase {
        constructor(container) {
            super(container);
        }
        isEnabled(particle) {
            return particle.options.collisions.enable;
        }
        reset() {
        }
        async interact(p1) {
            const container = this.container, pos1 = p1.getPosition(), radius1 = p1.getRadius(), query = container.particles.quadTree.queryCircle(pos1, radius1 * 2);
            for (const p2 of query) {
                if (p1 === p2 ||
                    !p2.options.collisions.enable ||
                    p1.options.collisions.mode !== p2.options.collisions.mode ||
                    p2.destroyed ||
                    p2.spawning) {
                    continue;
                }
                const pos2 = p2.getPosition();
                const radius2 = p2.getRadius();
                if (Math.abs(Math.round(pos1.z) - Math.round(pos2.z)) > radius1 + radius2) {
                    continue;
                }
                const dist = getDistance(pos1, pos2);
                const distP = radius1 + radius2;
                if (dist > distP) {
                    continue;
                }
                resolveCollision(p1, p2, container.fpsLimit / 1000, container.retina.pixelRatio);
            }
        }
    }

    async function loadParticlesCollisionsInteraction(engine) {
        await engine.addInteractor("particlesCollisions", (container) => new Collider(container));
    }

    function getLinkDistance(pos1, pos2, optDistance, canvasSize, warp) {
        let distance = getDistance(pos1, pos2);
        if (!warp || distance <= optDistance) {
            return distance;
        }
        const pos2NE = {
            x: pos2.x - canvasSize.width,
            y: pos2.y,
        };
        distance = getDistance(pos1, pos2NE);
        if (distance <= optDistance) {
            return distance;
        }
        const pos2SE = {
            x: pos2.x - canvasSize.width,
            y: pos2.y - canvasSize.height,
        };
        distance = getDistance(pos1, pos2SE);
        if (distance <= optDistance) {
            return distance;
        }
        const pos2SW = {
            x: pos2.x,
            y: pos2.y - canvasSize.height,
        };
        distance = getDistance(pos1, pos2SW);
        return distance;
    }
    class Linker extends ParticlesInteractorBase {
        constructor(container) {
            super(container);
        }
        isEnabled(particle) {
            return particle.options.links.enable;
        }
        reset() {
        }
        async interact(p1) {
            var _a;
            p1.links = [];
            const pos1 = p1.getPosition(), container = this.container, canvasSize = container.canvas.size;
            if (pos1.x < 0 || pos1.y < 0 || pos1.x > canvasSize.width || pos1.y > canvasSize.height) {
                return;
            }
            const linkOpt1 = p1.options.links, optOpacity = linkOpt1.opacity, optDistance = (_a = p1.retina.linksDistance) !== null && _a !== void 0 ? _a : container.retina.linksDistance, warp = linkOpt1.warp, range = warp
                ? new CircleWarp(pos1.x, pos1.y, optDistance, canvasSize)
                : new Circle(pos1.x, pos1.y, optDistance), query = container.particles.quadTree.query(range);
            for (const p2 of query) {
                const linkOpt2 = p2.options.links;
                if (p1 === p2 ||
                    !linkOpt2.enable ||
                    linkOpt1.id !== linkOpt2.id ||
                    p2.spawning ||
                    p2.destroyed ||
                    p1.links.map((t) => t.destination).indexOf(p2) !== -1 ||
                    p2.links.map((t) => t.destination).indexOf(p1) !== -1) {
                    continue;
                }
                const pos2 = p2.getPosition();
                if (pos2.x < 0 || pos2.y < 0 || pos2.x > canvasSize.width || pos2.y > canvasSize.height) {
                    continue;
                }
                const distance = getLinkDistance(pos1, pos2, optDistance, canvasSize, warp && linkOpt2.warp);
                if (distance > optDistance) {
                    return;
                }
                const opacityLine = (1 - distance / optDistance) * optOpacity;
                this.setColor(p1);
                p1.links.push({
                    destination: p2,
                    opacity: opacityLine,
                });
            }
        }
        setColor(p1) {
            const container = this.container, linksOptions = p1.options.links;
            let linkColor = linksOptions.id === undefined
                ? container.particles.linksColor
                : container.particles.linksColors.get(linksOptions.id);
            if (!linkColor) {
                const optColor = linksOptions.color;
                linkColor = getLinkRandomColor(optColor, linksOptions.blink, linksOptions.consent);
                if (linksOptions.id === undefined) {
                    container.particles.linksColor = linkColor;
                }
                else {
                    container.particles.linksColors.set(linksOptions.id, linkColor);
                }
            }
        }
    }

    async function loadInteraction(engine) {
        await engine.addInteractor("particlesLinks", (container) => new Linker(container));
    }

    function drawLinkLine(context, width, begin, end, maxDistance, canvasSize, warp, backgroundMask, composite, colorLine, opacity, shadow) {
        let drawn = false;
        if (getDistance(begin, end) <= maxDistance) {
            drawLine(context, begin, end);
            drawn = true;
        }
        else if (warp) {
            let pi1;
            let pi2;
            const endNE = {
                x: end.x - canvasSize.width,
                y: end.y,
            };
            const d1 = getDistances(begin, endNE);
            if (d1.distance <= maxDistance) {
                const yi = begin.y - (d1.dy / d1.dx) * begin.x;
                pi1 = { x: 0, y: yi };
                pi2 = { x: canvasSize.width, y: yi };
            }
            else {
                const endSW = {
                    x: end.x,
                    y: end.y - canvasSize.height,
                };
                const d2 = getDistances(begin, endSW);
                if (d2.distance <= maxDistance) {
                    const yi = begin.y - (d2.dy / d2.dx) * begin.x;
                    const xi = -yi / (d2.dy / d2.dx);
                    pi1 = { x: xi, y: 0 };
                    pi2 = { x: xi, y: canvasSize.height };
                }
                else {
                    const endSE = {
                        x: end.x - canvasSize.width,
                        y: end.y - canvasSize.height,
                    };
                    const d3 = getDistances(begin, endSE);
                    if (d3.distance <= maxDistance) {
                        const yi = begin.y - (d3.dy / d3.dx) * begin.x;
                        const xi = -yi / (d3.dy / d3.dx);
                        pi1 = { x: xi, y: yi };
                        pi2 = { x: pi1.x + canvasSize.width, y: pi1.y + canvasSize.height };
                    }
                }
            }
            if (pi1 && pi2) {
                drawLine(context, begin, pi1);
                drawLine(context, end, pi2);
                drawn = true;
            }
        }
        if (!drawn) {
            return;
        }
        context.lineWidth = width;
        if (backgroundMask) {
            context.globalCompositeOperation = composite;
        }
        context.strokeStyle = getStyleFromRgb(colorLine, opacity);
        if (shadow.enable) {
            const shadowColor = colorToRgb(shadow.color);
            if (shadowColor) {
                context.shadowBlur = shadow.blur;
                context.shadowColor = getStyleFromRgb(shadowColor);
            }
        }
        context.stroke();
    }
    function drawLinkTriangle(context, pos1, pos2, pos3, backgroundMask, composite, colorTriangle, opacityTriangle) {
        drawTriangle(context, pos1, pos2, pos3);
        if (backgroundMask) {
            context.globalCompositeOperation = composite;
        }
        context.fillStyle = getStyleFromRgb(colorTriangle, opacityTriangle);
        context.fill();
    }

    class LinkInstance {
        constructor(container) {
            this.container = container;
        }
        particleCreated(particle) {
            const linkParticle = particle;
            linkParticle.links = [];
        }
        particleDestroyed(particle) {
            const linkParticle = particle;
            linkParticle.links = [];
        }
        drawParticle(context, particle) {
            const linkParticle = particle, container = this.container, particles = container.particles, pOptions = particle.options;
            if (linkParticle.links.length <= 0) {
                return;
            }
            context.save();
            const p1Links = linkParticle.links.filter((l) => {
                const linkFreq = container.particles.getLinkFrequency(linkParticle, l.destination);
                return linkFreq <= pOptions.links.frequency;
            });
            for (const link of p1Links) {
                const p2 = link.destination;
                if (pOptions.links.triangles.enable) {
                    const links = p1Links.map((l) => l.destination), vertices = p2.links.filter((t) => {
                        const linkFreq = container.particles.getLinkFrequency(p2, t.destination);
                        return linkFreq <= p2.options.links.frequency && links.indexOf(t.destination) >= 0;
                    });
                    if (vertices.length) {
                        for (const vertex of vertices) {
                            const p3 = vertex.destination, triangleFreq = particles.getTriangleFrequency(linkParticle, p2, p3);
                            if (triangleFreq > pOptions.links.triangles.frequency) {
                                continue;
                            }
                            this.drawLinkTriangle(linkParticle, link, vertex);
                        }
                    }
                }
                if (link.opacity > 0 && container.retina.linksWidth > 0) {
                    this.drawLinkLine(linkParticle, link);
                }
            }
            context.restore();
        }
        drawLinkTriangle(p1, link1, link2) {
            var _a;
            const container = this.container, options = container.actualOptions, p2 = link1.destination, p3 = link2.destination, triangleOptions = p1.options.links.triangles, opacityTriangle = (_a = triangleOptions.opacity) !== null && _a !== void 0 ? _a : (link1.opacity + link2.opacity) / 2;
            if (opacityTriangle <= 0) {
                return;
            }
            container.canvas.draw((ctx) => {
                const pos1 = p1.getPosition();
                const pos2 = p2.getPosition();
                const pos3 = p3.getPosition();
                if (getDistance(pos1, pos2) > container.retina.linksDistance ||
                    getDistance(pos3, pos2) > container.retina.linksDistance ||
                    getDistance(pos3, pos1) > container.retina.linksDistance) {
                    return;
                }
                let colorTriangle = colorToRgb(triangleOptions.color);
                if (!colorTriangle) {
                    const linksOptions = p1.options.links, linkColor = linksOptions.id !== undefined
                        ? container.particles.linksColors.get(linksOptions.id)
                        : container.particles.linksColor;
                    colorTriangle = getLinkColor(p1, p2, linkColor);
                }
                if (!colorTriangle) {
                    return;
                }
                drawLinkTriangle(ctx, pos1, pos2, pos3, options.backgroundMask.enable, options.backgroundMask.composite, colorTriangle, opacityTriangle);
            });
        }
        drawLinkLine(p1, link) {
            const container = this.container, options = container.actualOptions, p2 = link.destination, pos1 = p1.getPosition(), pos2 = p2.getPosition();
            let opacity = link.opacity;
            container.canvas.draw((ctx) => {
                var _a, _b;
                let colorLine;
                const twinkle = p1.options.twinkle.lines;
                if (twinkle.enable) {
                    const twinkleFreq = twinkle.frequency, twinkleRgb = colorToRgb(twinkle.color), twinkling = Math.random() < twinkleFreq;
                    if (twinkling && twinkleRgb) {
                        colorLine = twinkleRgb;
                        opacity = getRangeValue(twinkle.opacity);
                    }
                }
                if (!colorLine) {
                    const linksOptions = p1.options.links, linkColor = linksOptions.id !== undefined
                        ? container.particles.linksColors.get(linksOptions.id)
                        : container.particles.linksColor;
                    colorLine = getLinkColor(p1, p2, linkColor);
                }
                if (!colorLine) {
                    return;
                }
                const width = (_a = p1.retina.linksWidth) !== null && _a !== void 0 ? _a : container.retina.linksWidth, maxDistance = (_b = p1.retina.linksDistance) !== null && _b !== void 0 ? _b : container.retina.linksDistance;
                drawLinkLine(ctx, width, pos1, pos2, maxDistance, container.canvas.size, p1.options.links.warp, options.backgroundMask.enable, options.backgroundMask.composite, colorLine, opacity, p1.options.links.shadow);
            });
        }
    }

    class LinksPlugin {
        constructor() {
            this.id = "links";
        }
        getPlugin(container) {
            return new LinkInstance(container);
        }
        needsPlugin() {
            return true;
        }
        loadOptions() {
        }
    }
    async function loadPlugin(engine) {
        const plugin = new LinksPlugin();
        await engine.addPlugin(plugin);
    }

    async function loadParticlesLinksInteraction(engine) {
        await loadInteraction(engine);
        await loadPlugin(engine);
    }

    class PolygonDrawerBase {
        getSidesCount(particle) {
            var _a, _b;
            const polygon = particle.shapeData;
            return (_b = (_a = polygon === null || polygon === void 0 ? void 0 : polygon.sides) !== null && _a !== void 0 ? _a : polygon === null || polygon === void 0 ? void 0 : polygon.nb_sides) !== null && _b !== void 0 ? _b : 5;
        }
        draw(context, particle, radius) {
            const start = this.getCenter(particle, radius);
            const side = this.getSidesData(particle, radius);
            const sideCount = side.count.numerator * side.count.denominator;
            const decimalSides = side.count.numerator / side.count.denominator;
            const interiorAngleDegrees = (180 * (decimalSides - 2)) / decimalSides;
            const interiorAngle = Math.PI - (Math.PI * interiorAngleDegrees) / 180;
            if (!context) {
                return;
            }
            context.beginPath();
            context.translate(start.x, start.y);
            context.moveTo(0, 0);
            for (let i = 0; i < sideCount; i++) {
                context.lineTo(side.length, 0);
                context.translate(side.length, 0);
                context.rotate(interiorAngle);
            }
        }
    }

    class PolygonDrawer extends PolygonDrawerBase {
        getSidesData(particle, radius) {
            var _a, _b;
            const polygon = particle.shapeData;
            const sides = (_b = (_a = polygon === null || polygon === void 0 ? void 0 : polygon.sides) !== null && _a !== void 0 ? _a : polygon === null || polygon === void 0 ? void 0 : polygon.nb_sides) !== null && _b !== void 0 ? _b : 5;
            return {
                count: {
                    denominator: 1,
                    numerator: sides,
                },
                length: (radius * 2.66) / (sides / 3),
            };
        }
        getCenter(particle, radius) {
            const sides = this.getSidesCount(particle);
            return {
                x: -radius / (sides / 3.5),
                y: -radius / (2.66 / 3.5),
            };
        }
    }

    class TriangleDrawer extends PolygonDrawerBase {
        getSidesCount() {
            return 3;
        }
        getSidesData(particle, radius) {
            return {
                count: {
                    denominator: 2,
                    numerator: 3,
                },
                length: radius * 2,
            };
        }
        getCenter(particle, radius) {
            return {
                x: -radius,
                y: radius / 1.66,
            };
        }
    }

    async function loadGenericPolygonShape(engine) {
        await engine.addShape("polygon", new PolygonDrawer());
    }
    async function loadTriangleShape(engine) {
        await engine.addShape("triangle", new TriangleDrawer());
    }
    async function loadPolygonShape(engine) {
        await loadGenericPolygonShape(engine);
        await loadTriangleShape(engine);
    }

    function checkDestroy(particle, value, minValue, maxValue) {
        switch (particle.options.size.animation.destroy) {
            case "max":
                if (value >= maxValue) {
                    particle.destroy();
                }
                break;
            case "min":
                if (value <= minValue) {
                    particle.destroy();
                }
                break;
        }
    }
    function updateSize(particle, delta) {
        var _a, _b, _c, _d;
        const sizeVelocity = ((_a = particle.size.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor;
        const minValue = particle.size.min;
        const maxValue = particle.size.max;
        if (particle.destroyed ||
            !particle.size.enable ||
            (((_b = particle.size.maxLoops) !== null && _b !== void 0 ? _b : 0) > 0 && ((_c = particle.size.loops) !== null && _c !== void 0 ? _c : 0) > ((_d = particle.size.maxLoops) !== null && _d !== void 0 ? _d : 0))) {
            return;
        }
        switch (particle.size.status) {
            case 0:
                if (particle.size.value >= maxValue) {
                    particle.size.status = 1;
                    if (!particle.size.loops) {
                        particle.size.loops = 0;
                    }
                    particle.size.loops++;
                }
                else {
                    particle.size.value += sizeVelocity;
                }
                break;
            case 1:
                if (particle.size.value <= minValue) {
                    particle.size.status = 0;
                    if (!particle.size.loops) {
                        particle.size.loops = 0;
                    }
                    particle.size.loops++;
                }
                else {
                    particle.size.value -= sizeVelocity;
                }
        }
        checkDestroy(particle, particle.size.value, minValue, maxValue);
        if (!particle.destroyed) {
            particle.size.value = clamp(particle.size.value, minValue, maxValue);
        }
    }
    class SizeUpdater {
        init() {
        }
        isEnabled(particle) {
            var _a, _b, _c, _d;
            return (!particle.destroyed &&
                !particle.spawning &&
                particle.size.enable &&
                (((_a = particle.size.maxLoops) !== null && _a !== void 0 ? _a : 0) <= 0 ||
                    (((_b = particle.size.maxLoops) !== null && _b !== void 0 ? _b : 0) > 0 && ((_c = particle.size.loops) !== null && _c !== void 0 ? _c : 0) < ((_d = particle.size.maxLoops) !== null && _d !== void 0 ? _d : 0))));
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            updateSize(particle, delta);
        }
    }

    async function loadSizeUpdater(engine) {
        await engine.addParticleUpdater("size", () => new SizeUpdater());
    }

    const fixFactor = Math.sqrt(2);
    class SquareDrawer {
        getSidesCount() {
            return 4;
        }
        draw(context, particle, radius) {
            context.rect(-radius / fixFactor, -radius / fixFactor, (radius * 2) / fixFactor, (radius * 2) / fixFactor);
        }
    }

    async function loadSquareShape(engine) {
        const drawer = new SquareDrawer();
        await engine.addShape("edge", drawer);
        await engine.addShape("square", drawer);
    }

    class StarDrawer {
        getSidesCount(particle) {
            var _a, _b;
            const star = particle.shapeData;
            return (_b = (_a = star === null || star === void 0 ? void 0 : star.sides) !== null && _a !== void 0 ? _a : star === null || star === void 0 ? void 0 : star.nb_sides) !== null && _b !== void 0 ? _b : 5;
        }
        draw(context, particle, radius) {
            var _a;
            const star = particle.shapeData;
            const sides = this.getSidesCount(particle);
            const inset = (_a = star === null || star === void 0 ? void 0 : star.inset) !== null && _a !== void 0 ? _a : 2;
            context.moveTo(0, 0 - radius);
            for (let i = 0; i < sides; i++) {
                context.rotate(Math.PI / sides);
                context.lineTo(0, 0 - radius * inset);
                context.rotate(Math.PI / sides);
                context.lineTo(0, 0 - radius);
            }
        }
    }

    async function loadStarShape(engine) {
        await engine.addShape("star", new StarDrawer());
    }

    function updateColorValue(delta, value, valueAnimation, max, decrease) {
        var _a;
        const colorValue = value;
        if (!colorValue || !colorValue.enable) {
            return;
        }
        const offset = randomInRange(valueAnimation.offset);
        const velocity = ((_a = value.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor + offset * 3.6;
        if (!decrease || colorValue.status === 0) {
            colorValue.value += velocity;
            if (decrease && colorValue.value > max) {
                colorValue.status = 1;
                colorValue.value -= colorValue.value % max;
            }
        }
        else {
            colorValue.value -= velocity;
            if (colorValue.value < 0) {
                colorValue.status = 0;
                colorValue.value += colorValue.value;
            }
        }
        if (colorValue.value > max) {
            colorValue.value %= max;
        }
    }
    function updateStrokeColor(particle, delta) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (!((_a = particle.stroke) === null || _a === void 0 ? void 0 : _a.color)) {
            return;
        }
        const animationOptions = particle.stroke.color.animation;
        const h = (_c = (_b = particle.strokeColor) === null || _b === void 0 ? void 0 : _b.h) !== null && _c !== void 0 ? _c : (_d = particle.color) === null || _d === void 0 ? void 0 : _d.h;
        if (h) {
            updateColorValue(delta, h, animationOptions.h, 360, false);
        }
        const s = (_f = (_e = particle.strokeColor) === null || _e === void 0 ? void 0 : _e.s) !== null && _f !== void 0 ? _f : (_g = particle.color) === null || _g === void 0 ? void 0 : _g.s;
        if (s) {
            updateColorValue(delta, s, animationOptions.s, 100, true);
        }
        const l = (_j = (_h = particle.strokeColor) === null || _h === void 0 ? void 0 : _h.l) !== null && _j !== void 0 ? _j : (_k = particle.color) === null || _k === void 0 ? void 0 : _k.l;
        if (l) {
            updateColorValue(delta, l, animationOptions.l, 100, true);
        }
    }
    class StrokeColorUpdater {
        constructor(container) {
            this.container = container;
        }
        init(particle) {
            var _a, _b;
            const container = this.container;
            particle.stroke =
                particle.options.stroke instanceof Array
                    ? itemFromArray(particle.options.stroke, particle.id, particle.options.reduceDuplicates)
                    : particle.options.stroke;
            particle.strokeWidth = particle.stroke.width * container.retina.pixelRatio;
            const strokeHslColor = (_a = colorToHsl(particle.stroke.color)) !== null && _a !== void 0 ? _a : particle.getFillColor();
            if (strokeHslColor) {
                particle.strokeColor = getHslAnimationFromHsl(strokeHslColor, (_b = particle.stroke.color) === null || _b === void 0 ? void 0 : _b.animation, container.retina.reduceFactor);
            }
        }
        isEnabled(particle) {
            var _a, _b, _c, _d;
            const color = (_a = particle.stroke) === null || _a === void 0 ? void 0 : _a.color;
            return (!particle.destroyed &&
                !particle.spawning &&
                !!color &&
                ((((_b = particle.strokeColor) === null || _b === void 0 ? void 0 : _b.h.value) !== undefined && color.animation.h.enable) ||
                    (((_c = particle.strokeColor) === null || _c === void 0 ? void 0 : _c.s.value) !== undefined && color.animation.s.enable) ||
                    (((_d = particle.strokeColor) === null || _d === void 0 ? void 0 : _d.l.value) !== undefined && color.animation.l.enable)));
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            updateStrokeColor(particle, delta);
        }
    }

    async function loadStrokeColorUpdater(engine) {
        await engine.addParticleUpdater("strokeColor", (container) => new StrokeColorUpdater(container));
    }

    const validTypes = ["text", "character", "char"];
    class TextDrawer {
        getSidesCount() {
            return 12;
        }
        async init(container) {
            const options = container.actualOptions;
            if (validTypes.find((t) => isInArray(t, options.particles.shape.type))) {
                const shapeOptions = validTypes
                    .map((t) => options.particles.shape.options[t])
                    .find((t) => !!t);
                if (shapeOptions instanceof Array) {
                    const promises = [];
                    for (const character of shapeOptions) {
                        const charShape = character;
                        promises.push(loadFont(charShape.font, charShape.weight));
                    }
                    await Promise.allSettled(promises);
                }
                else {
                    if (shapeOptions !== undefined) {
                        const charShape = shapeOptions;
                        await loadFont(charShape.font, charShape.weight);
                    }
                }
            }
        }
        draw(context, particle, radius, opacity) {
            var _a, _b, _c;
            const character = particle.shapeData;
            if (character === undefined) {
                return;
            }
            const textData = character.value;
            if (textData === undefined) {
                return;
            }
            const textParticle = particle;
            if (textParticle.text === undefined) {
                textParticle.text =
                    textData instanceof Array ? itemFromArray(textData, particle.randomIndexData) : textData;
            }
            const text = textParticle.text;
            const style = (_a = character.style) !== null && _a !== void 0 ? _a : "";
            const weight = (_b = character.weight) !== null && _b !== void 0 ? _b : "400";
            const size = Math.round(radius) * 2;
            const font = (_c = character.font) !== null && _c !== void 0 ? _c : "Verdana";
            const fill = particle.fill;
            const offsetX = (text.length * radius) / 2;
            context.font = `${style} ${weight} ${size}px "${font}"`;
            const pos = {
                x: -offsetX,
                y: radius / 2,
            };
            context.globalAlpha = opacity;
            if (fill) {
                context.fillText(text, pos.x, pos.y);
            }
            else {
                context.strokeText(text, pos.x, pos.y);
            }
            context.globalAlpha = 1;
        }
    }

    async function loadTextShape(engine) {
        const drawer = new TextDrawer();
        for (const type of validTypes) {
            await engine.addShape(type, drawer);
        }
    }

    async function loadSlim(engine) {
        await loadBaseMover(engine);
        await loadParallaxMover(engine);
        await loadExternalAttractInteraction(engine);
        await loadExternalBounceInteraction(engine);
        await loadExternalBubbleInteraction(engine);
        await loadExternalConnectInteraction(engine);
        await loadExternalGrabInteraction(engine);
        await loadExternalPauseInteraction(engine);
        await loadExternalPushInteraction(engine);
        await loadExternalRemoveInteraction(engine);
        await loadExternalRepulseInteraction(engine);
        await loadParticlesAttractInteraction(engine);
        await loadParticlesCollisionsInteraction(engine);
        await loadParticlesLinksInteraction(engine);
        await loadCircleShape(engine);
        await loadImageShape(engine);
        await loadLineShape(engine);
        await loadPolygonShape(engine);
        await loadSquareShape(engine);
        await loadStarShape(engine);
        await loadTextShape(engine);
        await loadLifeUpdater(engine);
        await loadOpacityUpdater(engine);
        await loadSizeUpdater(engine);
        await loadAngleUpdater(engine);
        await loadColorUpdater(engine);
        await loadStrokeColorUpdater(engine);
        await loadOutModesUpdater(engine);
        await initPjs(engine);
    }

    function updateTilt(particle, delta) {
        var _a;
        if (!particle.tilt) {
            return;
        }
        const tilt = particle.options.tilt;
        const tiltAnimation = tilt.animation;
        const speed = ((_a = particle.tilt.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor;
        const max = 2 * Math.PI;
        if (!tiltAnimation.enable) {
            return;
        }
        switch (particle.tilt.status) {
            case 0:
                particle.tilt.value += speed;
                if (particle.tilt.value > max) {
                    particle.tilt.value -= max;
                }
                break;
            case 1:
            default:
                particle.tilt.value -= speed;
                if (particle.tilt.value < 0) {
                    particle.tilt.value += max;
                }
                break;
        }
    }
    class TiltUpdater {
        constructor(container) {
            this.container = container;
        }
        init(particle) {
            const tiltOptions = particle.options.tilt;
            particle.tilt = {
                enable: tiltOptions.enable,
                value: (getRangeValue(tiltOptions.value) * Math.PI) / 180,
                sinDirection: Math.random() >= 0.5 ? 1 : -1,
                cosDirection: Math.random() >= 0.5 ? 1 : -1,
            };
            let tiltDirection = tiltOptions.direction;
            if (tiltDirection === "random") {
                const index = Math.floor(Math.random() * 2);
                tiltDirection = index > 0 ? "counter-clockwise" : "clockwise";
            }
            switch (tiltDirection) {
                case "counter-clockwise":
                case "counterClockwise":
                    particle.tilt.status = 1;
                    break;
                case "clockwise":
                    particle.tilt.status = 0;
                    break;
            }
            const tiltAnimation = particle.options.tilt.animation;
            if (tiltAnimation.enable) {
                particle.tilt.velocity = (getRangeValue(tiltAnimation.speed) / 360) * this.container.retina.reduceFactor;
                if (!tiltAnimation.sync) {
                    particle.tilt.velocity *= Math.random();
                }
            }
        }
        isEnabled(particle) {
            const tilt = particle.options.tilt;
            const tiltAnimation = tilt.animation;
            return !particle.destroyed && !particle.spawning && tiltAnimation.enable;
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            updateTilt(particle, delta);
        }
    }

    async function loadTiltUpdater(engine) {
        await engine.addParticleUpdater("tilt", (container) => new TiltUpdater(container));
    }

    class TwinkleUpdater {
        getColorStyles(particle, context, radius, opacity) {
            const pOptions = particle.options, twinkle = pOptions.twinkle.particles, twinkling = twinkle.enable && Math.random() < twinkle.frequency, zIndexOptions = particle.options.zIndex, zOpacityFactor = (1 - particle.zIndexFactor) ** zIndexOptions.opacityRate, twinklingOpacity = twinkling ? getRangeValue(twinkle.opacity) * zOpacityFactor : opacity, twinkleRgb = colorToHsl(twinkle.color), twinkleStyle = twinkleRgb ? getStyleFromHsl(twinkleRgb, twinklingOpacity) : undefined, res = {}, needsTwinkle = twinkling && twinkleStyle;
            res.fill = needsTwinkle ? twinkleStyle : undefined;
            res.stroke = needsTwinkle ? twinkleStyle : undefined;
            return res;
        }
        init() {
        }
        isEnabled(particle) {
            return particle.options.twinkle.particles.enable;
        }
        update() {
        }
    }

    async function loadTwinkleUpdater(engine) {
        await engine.addParticleUpdater("twinkle", () => new TwinkleUpdater());
    }

    function updateWobble(particle, delta) {
        var _a;
        const wobble = particle.options.wobble;
        if (!wobble.enable || !particle.wobble) {
            return;
        }
        const speed = particle.wobble.speed * delta.factor;
        const distance = (((_a = particle.retina.wobbleDistance) !== null && _a !== void 0 ? _a : 0) * delta.factor) / (1000 / 60);
        const max = 2 * Math.PI;
        particle.wobble.angle += speed;
        if (particle.wobble.angle > max) {
            particle.wobble.angle -= max;
        }
        particle.position.x += distance * Math.cos(particle.wobble.angle);
        particle.position.y += distance * Math.abs(Math.sin(particle.wobble.angle));
    }
    class WobbleUpdater {
        constructor(container) {
            this.container = container;
        }
        init(particle) {
            const wobbleOpt = particle.options.wobble;
            if (wobbleOpt.enable) {
                particle.wobble = {
                    angle: Math.random() * Math.PI * 2,
                    speed: getRangeValue(wobbleOpt.speed) / 360,
                };
            }
            else {
                particle.wobble = {
                    angle: 0,
                    speed: 0,
                };
            }
            particle.retina.wobbleDistance = getRangeValue(wobbleOpt.distance) * this.container.retina.pixelRatio;
        }
        isEnabled(particle) {
            return !particle.destroyed && !particle.spawning && particle.options.wobble.enable;
        }
        update(particle, delta) {
            if (!this.isEnabled(particle)) {
                return;
            }
            updateWobble(particle, delta);
        }
    }

    async function loadWobbleUpdater(engine) {
        await engine.addParticleUpdater("wobble", (container) => new WobbleUpdater(container));
    }

    async function loadFull(engine) {
        await loadSlim(engine);
        await loadRollUpdater(engine);
        await loadTiltUpdater(engine);
        await loadTwinkleUpdater(engine);
        await loadWobbleUpdater(engine);
        await loadExternalTrailInteraction(engine);
        await loadAbsorbersPlugin(engine);
        await loadEmittersPlugin(engine);
        await loadPolygonMaskPlugin(engine);
    }

    /* src/App.svelte generated by Svelte v3.45.0 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let a0;
    	let svg0;
    	let g;
    	let rect0;
    	let path0;
    	let path1;
    	let rect1;
    	let path2;
    	let defs;
    	let clipPath;
    	let rect2;
    	let t0;
    	let h1;
    	let a1;
    	let t2;
    	let ul;
    	let li0;
    	let a2;
    	let t4;
    	let li1;
    	let a3;
    	let t6;
    	let li2;
    	let a4;
    	let t8;
    	let li3;
    	let a5;
    	let t10;
    	let li4;
    	let a6;
    	let t12;
    	let li5;
    	let a7;
    	let svg1;
    	let path3;
    	let path4;
    	let t13;
    	let footer;
    	let t14;
    	let a8;
    	let t16;
    	let particles;
    	let current;

    	particles = new Particles({
    			props: {
    				id: "tsparticles",
    				options: /*particlesConfig*/ ctx[0],
    				particlesInit: /*particlesInit*/ ctx[2]
    			},
    			$$inline: true
    		});

    	particles.$on("particlesLoaded", /*handleParticlesLoaded*/ ctx[1]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			a0 = element("a");
    			svg0 = svg_element("svg");
    			g = svg_element("g");
    			rect0 = svg_element("rect");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			rect1 = svg_element("rect");
    			path2 = svg_element("path");
    			defs = svg_element("defs");
    			clipPath = svg_element("clipPath");
    			rect2 = svg_element("rect");
    			t0 = space();
    			h1 = element("h1");
    			a1 = element("a");
    			a1.textContent = "MaDr";
    			t2 = space();
    			ul = element("ul");
    			li0 = element("li");
    			a2 = element("a");
    			a2.textContent = "Portfolio";
    			t4 = space();
    			li1 = element("li");
    			a3 = element("a");
    			a3.textContent = "Cloudful";
    			t6 = space();
    			li2 = element("li");
    			a4 = element("a");
    			a4.textContent = "Résumé";
    			t8 = space();
    			li3 = element("li");
    			a5 = element("a");
    			a5.textContent = "Some color?";
    			t10 = space();
    			li4 = element("li");
    			a6 = element("a");
    			a6.textContent = "svelteKitStripped";
    			t12 = space();
    			li5 = element("li");
    			a7 = element("a");
    			svg1 = svg_element("svg");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			t13 = space();
    			footer = element("footer");
    			t14 = text("2022 © ");
    			a8 = element("a");
    			a8.textContent = "MaDr";
    			t16 = space();
    			create_component(particles.$$.fragment);
    			attr_dev(rect0, "x", "43.8067");
    			attr_dev(rect0, "y", "68.6931");
    			attr_dev(rect0, "width", "11.3799");
    			attr_dev(rect0, "height", "17.0698");
    			attr_dev(rect0, "fill", "#BF0A30");
    			add_location(rect0, file, 31, 8, 796);
    			attr_dev(path0, "d", "M40.8715 70.8975C42.8439 68.8479 44.8303 67.7988 46.8306 67.7501C45.6911 68.9037 44.9272 70.0638 44.5386 71.2303C44.15 72.3969 43.9789 73.9282 44.025 75.8243C44.0464 76.6995 44.447 77.9563 45.2271 79.5948C46.0071 81.2332 46.7877 82.6788 47.5688 83.9316C48.3498 85.1843 48.7396 85.7795 48.7381 85.7169C48.7747 85.5076 48.8254 85.2353 48.8902 84.9001C48.955 84.565 49.127 83.9249 49.4063 82.9799C49.6856 82.0349 50.0029 81.1515 50.3581 80.3298C50.7134 79.508 51.2187 78.6409 51.8741 77.7284C52.5294 76.816 53.2469 76.1001 54.0265 75.5807C54.6623 75.1483 54.9892 74.4471 55.0073 73.4772C55.0253 72.5073 54.8239 71.5114 54.4029 70.4897C53.9818 69.4679 53.458 68.506 52.8315 67.6039C53.9566 67.5765 55.8197 68.7403 58.4206 71.0954C59.2942 71.8664 59.9463 72.747 60.377 73.7373C60.8076 74.7275 61.0326 75.6185 61.0519 76.4103C61.0844 77.7439 60.7484 79.1437 60.044 80.6098C59.3396 82.076 58.3757 83.3764 57.1524 84.5112C56.1131 85.4956 55.2783 86.5271 54.6478 87.6057C54.0173 88.6844 53.6199 89.7 53.4555 90.6526C53.291 91.6053 53.2356 92.5396 53.2892 93.4556C53.3428 94.3717 53.5035 95.1913 53.7713 95.9145C54.0391 96.6377 54.3048 97.2775 54.5686 97.834C54.8323 98.3905 55.0719 98.812 55.2874 99.0987L55.6114 99.5599C55.338 99.4623 54.9747 99.3148 54.5217 99.1173C54.0686 98.9199 53.1927 98.4825 51.894 97.8053C50.5953 97.1281 49.3636 96.418 48.1988 95.6749C47.034 94.9319 45.7596 93.9674 44.3756 92.7815C42.9915 91.5955 41.8464 90.3777 40.9403 89.128C39.6892 87.4072 38.7209 85.5283 38.0354 83.4914C37.3499 81.4545 37.0186 79.6227 37.0415 77.9959C37.0629 77.1615 37.3421 76.2165 37.8793 75.161C38.4165 74.1054 38.9379 73.2536 39.4433 72.6054C39.9487 71.9572 40.4248 71.3879 40.8715 70.8975Z");
    			attr_dev(path0, "fill", "#CE5C17");
    			add_location(path0, file, 32, 8, 884);
    			attr_dev(g, "clip-path", "url(#clip0_111_2)");
    			add_location(g, file, 30, 8, 754);
    			attr_dev(path1, "d", "M53.7785 64.3596V74.3907H45.7536V68.372H43.7474C42.1512 68.372 40.6203 67.7379 39.4916 66.6092C38.3628 65.4805 37.7287 63.9496 37.7287 62.3534V56.3347C37.7287 55.8026 37.9401 55.2923 38.3163 54.9161C38.6926 54.5399 39.2029 54.3285 39.735 54.3285C40.267 54.3285 40.7773 54.5399 41.1536 54.9161C41.5298 55.2923 41.7412 55.8026 41.7412 56.3347V62.3534C41.7412 63.4769 42.644 64.3596 43.7474 64.3596H45.7536V44.2974C45.7536 43.2332 46.1764 42.2126 46.9288 41.4601C47.6813 40.7077 48.7019 40.2849 49.7661 40.2849C50.8302 40.2849 51.8508 40.7077 52.6033 41.4601C53.3558 42.2126 53.7785 43.2332 53.7785 44.2974V60.3472H55.7847C56.3168 60.3472 56.8271 60.1358 57.2034 59.7595C57.5796 59.3833 57.791 58.873 57.791 58.3409V54.3285C57.791 53.7964 58.0023 53.2861 58.3786 52.9099C58.7548 52.5336 59.2651 52.3223 59.7972 52.3223C60.3293 52.3223 60.8396 52.5336 61.2158 52.9099C61.5921 53.2861 61.8034 53.7964 61.8034 54.3285V58.3409C61.8034 59.9372 61.1693 61.4681 60.0406 62.5968C58.9119 63.7255 57.381 64.3596 55.7847 64.3596H53.7785Z");
    			attr_dev(path1, "fill", "#FED700");
    			add_location(path1, file, 34, 8, 2619);
    			attr_dev(rect1, "x", "51.1237");
    			attr_dev(rect1, "y", "27.7601");
    			attr_dev(rect1, "width", "11.1869");
    			attr_dev(rect1, "height", "8.35387");
    			attr_dev(rect1, "fill", "#BF0A30");
    			add_location(rect1, file, 35, 8, 3678);
    			attr_dev(path2, "d", "M56.0024 34.7446C56.1483 34.7446 56.2896 34.7211 56.4167 34.674L56.2095 36.1193H54.9714L55.7011 34.7117C55.8 34.7352 55.8988 34.7446 56.0024 34.7446ZM36.182 21.0351C36.7752 21.0351 37.3495 21.1057 37.9004 21.2328C38.9079 19.425 40.8334 18.2056 43.0461 18.2056C43.371 18.2056 43.6864 18.2339 43.9971 18.281C45.6638 14.637 49.3359 12.1088 53.5966 12.1088C58.8837 12.1088 63.262 15.9976 64.0294 21.0728C67.8476 21.4447 70.8277 24.6602 70.8277 28.5772C70.8277 32.739 67.4568 36.1146 63.295 36.1193H60.941L60.3196 34.8199C61.5531 34.4292 62.3581 33.4546 62.1604 32.5225C61.9438 31.5056 60.6162 30.9265 59.1897 31.2278C58.1115 31.4585 57.2877 32.127 57.0476 32.8803C56.938 32.7026 56.785 32.5558 56.6029 32.4536C56.4209 32.3515 56.2158 32.2974 56.0071 32.2965H55.9977C56.0353 32.1458 56.0542 31.9905 56.0542 31.8304C56.0542 30.8841 55.3574 30.1026 54.4488 29.9661V28.7702C54.4488 28.5631 54.2793 28.3936 54.0721 28.3936C53.865 28.3936 53.6955 28.5631 53.6955 28.7702V30.0084C53.4789 30.0649 53.2812 30.1591 53.1023 30.2815L52.1843 29.274C52.043 29.1186 51.8076 29.1092 51.6523 29.2504C51.4969 29.3917 51.4875 29.6271 51.6287 29.7824L52.5703 30.8182L52.5797 30.8276C52.3706 31.1576 52.2693 31.5445 52.2898 31.9346C52.3104 32.3247 52.4517 32.6988 52.6943 33.005C52.9369 33.3112 53.2687 33.5344 53.6438 33.6436C54.0189 33.7529 54.4187 33.7428 54.7877 33.6147C54.8066 33.8784 54.9101 34.1185 55.0702 34.3115L54.1286 36.1193H35.9889V36.1146C31.9166 36.0111 28.6445 32.6778 28.6445 28.5772C28.6445 24.4107 32.0201 21.0351 36.182 21.0351ZM57.9185 34.707L58.121 36.1193H56.9722L57.25 34.1655C57.4148 34.3821 57.6408 34.5657 57.9185 34.707ZM36.295 14.3592C36.295 14.9586 36.0569 15.5334 35.6331 15.9572C35.2093 16.381 34.6345 16.619 34.0351 16.619C33.4358 16.619 32.861 16.381 32.4372 15.9572C32.0134 15.5334 31.7753 14.9586 31.7753 14.3592C31.7753 13.7599 32.0134 13.1851 32.4372 12.7613C32.861 12.3375 33.4358 12.0994 34.0351 12.0994C34.6345 12.0994 35.2093 12.3375 35.6331 12.7613C36.0569 13.1851 36.295 13.7599 36.295 14.3592ZM39.3881 17.2452C39.3881 17.3936 39.3588 17.5405 39.3021 17.6776C39.2453 17.8147 39.162 17.9392 39.0571 18.0442C38.9522 18.1491 38.8276 18.2323 38.6906 18.2891C38.5535 18.3459 38.4065 18.3751 38.2582 18.3751C38.1098 18.3751 37.9629 18.3459 37.8258 18.2891C37.6887 18.2323 37.5641 18.1491 37.4592 18.0442C37.3543 17.9392 37.271 17.8147 37.2143 17.6776C37.1575 17.5405 37.1283 17.3936 37.1283 17.2452C37.1283 17.0968 37.1575 16.9499 37.2143 16.8128C37.271 16.6757 37.3543 16.5512 37.4592 16.4462C37.5641 16.3413 37.6887 16.2581 37.8258 16.2013C37.9629 16.1445 38.1098 16.1153 38.2582 16.1153C38.4065 16.1153 38.5535 16.1445 38.6906 16.2013C38.8276 16.2581 38.9522 16.3413 39.0571 16.4462C39.162 16.5512 39.2453 16.6757 39.3021 16.8128C39.3588 16.9499 39.3881 17.0968 39.3881 17.2452ZM59.5569 34.9753L60.103 36.1193H58.8789L58.7142 34.9565C58.9825 34.9941 59.265 35.0036 59.5569 34.9753Z");
    			attr_dev(path2, "fill", "#002868");
    			add_location(path2, file, 36, 8, 3766);
    			attr_dev(rect2, "width", "24.0747");
    			attr_dev(rect2, "height", "32.0142");
    			attr_dev(rect2, "fill", "white");
    			attr_dev(rect2, "transform", "translate(61.6129 99.4137) rotate(178.605)");
    			add_location(rect2, file, 39, 8, 6752);
    			attr_dev(clipPath, "id", "clip0_111_2");
    			add_location(clipPath, file, 38, 8, 6716);
    			add_location(defs, file, 37, 8, 6701);
    			attr_dev(svg0, "width", "97");
    			attr_dev(svg0, "height", "100");
    			attr_dev(svg0, "viewBox", "0 0 97 100");
    			attr_dev(svg0, "fill", "none");
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg0, file, 29, 4, 648);
    			attr_dev(a0, "class", "off svelte-1sn5rm4");
    			attr_dev(a0, "href", "https://MaDr.io");
    			add_location(a0, file, 28, 4, 605);
    			attr_dev(a1, "class", "cursor svelte-1sn5rm4");
    			attr_dev(a1, "href", "https://madrslowed.netlify.app/");
    			add_location(a1, file, 44, 8, 6943);
    			add_location(h1, file, 44, 4, 6939);
    			attr_dev(a2, "class", "ar svelte-1sn5rm4");
    			attr_dev(a2, "href", "https://MatthewDrish.com");
    			add_location(a2, file, 46, 16, 7043);
    			add_location(li0, file, 46, 12, 7039);
    			attr_dev(a3, "class", "ay svelte-1sn5rm4");
    			attr_dev(a3, "href", "https://Cloudful.cloud");
    			add_location(a3, file, 47, 16, 7124);
    			add_location(li1, file, 47, 12, 7120);
    			attr_dev(a4, "class", "ag svelte-1sn5rm4");
    			attr_dev(a4, "href", "https://MaDrCloudDev.github.io");
    			add_location(a4, file, 48, 16, 7202);
    			add_location(li2, file, 48, 12, 7198);
    			attr_dev(a5, "class", "ag svelte-1sn5rm4");
    			attr_dev(a5, "href", "https://MaDr.blog");
    			add_location(a5, file, 49, 16, 7286);
    			add_location(li3, file, 49, 12, 7282);
    			attr_dev(a6, "class", "ap svelte-1sn5rm4");
    			attr_dev(a6, "href", "https://svelteKitStripped.netlify.app");
    			add_location(a6, file, 50, 16, 7362);
    			add_location(li4, file, 50, 12, 7358);
    			attr_dev(path3, "opacity", "0.2");
    			attr_dev(path3, "d", "M26.5625 14.875V15.9375C26.5625 17.6283 25.8909 19.2498 24.6953 20.4453C23.4998 21.6409 21.8783 22.3125 20.1875 22.3125H13.8125C12.1217 22.3125 10.5002 21.6409 9.30469 20.4453C8.10915 19.2498 7.4375 17.6283 7.4375 15.9375V14.875C7.44737 13.5814 7.8402 12.3198 8.56641 11.2492C8.19611 10.2877 8.04567 9.25543 8.1261 8.22818C8.20653 7.20094 8.5158 6.2047 9.03125 5.3125C10.1905 5.3129 11.331 5.60509 12.3476 6.16214C13.3642 6.71919 14.2242 7.52317 14.8484 8.5H19.1516C19.7758 7.52317 20.6358 6.71919 21.6524 6.16214C22.669 5.60509 23.8095 5.3129 24.9688 5.3125C25.4842 6.2047 25.7935 7.20094 25.8739 8.22818C25.9543 9.25543 25.8039 10.2877 25.4336 11.2492C26.1598 12.3198 26.5526 13.5814 26.5625 14.875V14.875Z");
    			attr_dev(path3, "fill", "#5A7830");
    			add_location(path3, file, 53, 20, 7668);
    			attr_dev(path4, "d", "M28.6875 28.6875C28.1239 28.6875 27.5834 28.4636 27.1849 28.0651C26.7864 27.6666 26.5625 27.1261 26.5625 26.5625V25.5C26.5616 24.7855 26.3812 24.0826 26.0377 23.456C25.6942 22.8294 25.1988 22.2992 24.5969 21.9141C25.5355 21.2257 26.2988 20.3259 26.8249 19.2875C27.351 18.2492 27.6251 17.1015 27.625 15.9375V14.875C27.6117 13.5552 27.2596 12.261 26.6023 11.1164C26.9261 10.0681 27.0296 8.96409 26.9061 7.87385C26.7827 6.78361 26.4351 5.73068 25.8852 4.78125C25.7943 4.61844 25.6613 4.48315 25.5 4.38965C25.3387 4.29614 25.1552 4.2479 24.9688 4.25C23.7311 4.24689 22.5099 4.53356 21.4029 5.08706C20.2959 5.64055 19.3339 6.44551 18.5938 7.4375H15.4062C14.6661 6.44551 13.7041 5.64055 12.5971 5.08706C11.4901 4.53356 10.2689 4.24689 9.03125 4.25C8.84483 4.2479 8.6613 4.29614 8.50001 4.38965C8.33872 4.48315 8.20566 4.61844 8.11484 4.78125C7.5649 5.73068 7.21729 6.78361 7.09386 7.87385C6.97044 8.96409 7.07387 10.0681 7.39766 11.1164C6.7404 12.261 6.38826 13.5552 6.375 14.875V15.9375C6.37492 17.1015 6.64902 18.2492 7.17512 19.2875C7.70121 20.3259 8.46449 21.2257 9.40313 21.9141C8.80122 22.2992 8.30577 22.8294 7.9623 23.456C7.61884 24.0826 7.43837 24.7855 7.4375 25.5V26.5625C7.4375 27.1261 7.21362 27.6666 6.8151 28.0651C6.41659 28.4636 5.87609 28.6875 5.3125 28.6875C5.03071 28.6875 4.76046 28.7994 4.5612 28.9987C4.36194 29.198 4.25 29.4682 4.25 29.75C4.25 30.0318 4.36194 30.3021 4.5612 30.5013C4.76046 30.7006 5.03071 30.8125 5.3125 30.8125C6.43859 30.809 7.51756 30.3601 8.31383 29.5638C9.11011 28.7676 9.559 27.6886 9.5625 26.5625V25.5C9.5625 24.9364 9.78638 24.3959 10.1849 23.9974C10.5834 23.5989 11.1239 23.375 11.6875 23.375H13.2812V28.6875C13.2812 29.2511 13.0574 29.7916 12.6589 30.1901C12.2603 30.5886 11.7198 30.8125 11.1562 30.8125C10.8745 30.8125 10.6042 30.9244 10.4049 31.1237C10.2057 31.323 10.0938 31.5932 10.0938 31.875C10.0938 32.1568 10.2057 32.4271 10.4049 32.6263C10.6042 32.8256 10.8745 32.9375 11.1562 32.9375C12.2823 32.934 13.3613 32.4851 14.1576 31.6888C14.9539 30.8926 15.4027 29.8136 15.4062 28.6875V23.375H18.5938V28.6875C18.5973 29.8136 19.0461 30.8926 19.8424 31.6888C20.6387 32.4851 21.7177 32.934 22.8438 32.9375C23.1255 32.9375 23.3958 32.8256 23.5951 32.6263C23.7943 32.4271 23.9062 32.1568 23.9062 31.875C23.9062 31.5932 23.7943 31.323 23.5951 31.1237C23.3958 30.9244 23.1255 30.8125 22.8438 30.8125C22.2802 30.8125 21.7397 30.5886 21.3411 30.1901C20.9426 29.7916 20.7188 29.2511 20.7188 28.6875V23.375H22.3125C22.8761 23.375 23.4166 23.5989 23.8151 23.9974C24.2136 24.3959 24.4375 24.9364 24.4375 25.5V26.5625C24.441 27.6886 24.8899 28.7676 25.6862 29.5638C26.4824 30.3601 27.5614 30.809 28.6875 30.8125C28.9693 30.8125 29.2395 30.7006 29.4388 30.5013C29.6381 30.3021 29.75 30.0318 29.75 29.75C29.75 29.4682 29.6381 29.198 29.4388 28.9987C29.2395 28.7994 28.9693 28.6875 28.6875 28.6875ZM8.5 15.9375V14.875C8.51952 13.8127 8.83705 12.7773 9.41641 11.8867C9.52691 11.7433 9.59843 11.5738 9.62403 11.3946C9.64963 11.2154 9.62843 11.0326 9.5625 10.8641C9.28661 10.1519 9.15399 9.39236 9.17222 8.62887C9.19045 7.86538 9.35919 7.113 9.66875 6.41485C10.5379 6.50524 11.3753 6.79115 12.1182 7.25117C12.8611 7.71118 13.4903 8.33337 13.9586 9.0711C14.054 9.22084 14.1855 9.34428 14.3409 9.43012C14.4964 9.51596 14.6709 9.56148 14.8484 9.5625H19.1516C19.3291 9.56148 19.5036 9.51596 19.6591 9.43012C19.8145 9.34428 19.946 9.22084 20.0414 9.0711C20.5097 8.33337 21.1389 7.71118 21.8818 7.25117C22.6247 6.79115 23.4621 6.50524 24.3312 6.41485C24.6408 7.113 24.8095 7.86538 24.8278 8.62887C24.846 9.39236 24.7134 10.1519 24.4375 10.8641C24.3753 11.0333 24.3561 11.2153 24.3816 11.3938C24.4071 11.5723 24.4765 11.7417 24.5836 11.8867C25.163 12.7773 25.4805 13.8127 25.5 14.875V15.9375C25.5 16.6352 25.3626 17.326 25.0956 17.9705C24.8286 18.6151 24.4373 19.2007 23.944 19.694C23.4507 20.1873 22.865 20.5786 22.2205 20.8456C21.576 21.1126 20.8851 21.25 20.1875 21.25H13.8125C12.4035 21.25 11.0523 20.6903 10.056 19.694C9.05971 18.6977 8.5 17.3465 8.5 15.9375Z");
    			attr_dev(path4, "fill", "#5A7830");
    			add_location(path4, file, 54, 20, 8438);
    			attr_dev(svg1, "class", "feedback svelte-1sn5rm4");
    			attr_dev(svg1, "width", "34");
    			attr_dev(svg1, "height", "34");
    			attr_dev(svg1, "viewBox", "0 0 34 34");
    			attr_dev(svg1, "fill", "none");
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg1, file, 52, 16, 7535);
    			attr_dev(a7, "class", "off svelte-1sn5rm4");
    			attr_dev(a7, "href", "https://github.com/MaDrCloudDev");
    			add_location(a7, file, 51, 16, 7464);
    			add_location(li5, file, 51, 12, 7460);
    			add_location(ul, file, 45, 8, 7022);
    			attr_dev(a8, "class", "footerlink svelte-1sn5rm4");
    			attr_dev(a8, "href", "https://MaDr.io");
    			add_location(a8, file, 57, 27, 12553);
    			add_location(footer, file, 57, 12, 12538);
    			add_location(main, file, 27, 0, 594);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, a0);
    			append_dev(a0, svg0);
    			append_dev(svg0, g);
    			append_dev(g, rect0);
    			append_dev(g, path0);
    			append_dev(svg0, path1);
    			append_dev(svg0, rect1);
    			append_dev(svg0, path2);
    			append_dev(svg0, defs);
    			append_dev(defs, clipPath);
    			append_dev(clipPath, rect2);
    			append_dev(main, t0);
    			append_dev(main, h1);
    			append_dev(h1, a1);
    			append_dev(main, t2);
    			append_dev(main, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a2);
    			append_dev(ul, t4);
    			append_dev(ul, li1);
    			append_dev(li1, a3);
    			append_dev(ul, t6);
    			append_dev(ul, li2);
    			append_dev(li2, a4);
    			append_dev(ul, t8);
    			append_dev(ul, li3);
    			append_dev(li3, a5);
    			append_dev(ul, t10);
    			append_dev(ul, li4);
    			append_dev(li4, a6);
    			append_dev(ul, t12);
    			append_dev(ul, li5);
    			append_dev(li5, a7);
    			append_dev(a7, svg1);
    			append_dev(svg1, path3);
    			append_dev(svg1, path4);
    			append_dev(main, t13);
    			append_dev(main, footer);
    			append_dev(footer, t14);
    			append_dev(footer, a8);
    			append_dev(main, t16);
    			mount_component(particles, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(particles.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(particles.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(particles);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { name } = $$props;

    	let particlesConfig = {
    		particles: {
    			color: { value: '#' },
    			links: { enable: true, color: '#BCBCBC' },
    			move: { enable: true }
    		}
    	};

    	let ref = {};

    	let handleParticlesLoaded = e => {
    		const container = e.detail.particles;
    		console.log(container);
    	}; // use container to call its methods

    	let particlesInit = async main => {
    		await loadFull(main);
    	};

    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(3, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		Particles,
    		loadFull,
    		name,
    		particlesConfig,
    		ref,
    		handleParticlesLoaded,
    		particlesInit
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(3, name = $$props.name);
    		if ('particlesConfig' in $$props) $$invalidate(0, particlesConfig = $$props.particlesConfig);
    		if ('ref' in $$props) ref = $$props.ref;
    		if ('handleParticlesLoaded' in $$props) $$invalidate(1, handleParticlesLoaded = $$props.handleParticlesLoaded);
    		if ('particlesInit' in $$props) $$invalidate(2, particlesInit = $$props.particlesInit);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [particlesConfig, handleParticlesLoaded, particlesInit, name];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[3] === undefined && !('name' in props)) {
    			console_1.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            name: 'MaDr'
        }
    });

    (function () {
        try {
            if (typeof window === "undefined")
                return;
            if (!("SVGPathSeg" in window)) {
                window.SVGPathSeg = function (type, typeAsLetter, owningPathSegList) {
                    this.pathSegType = type;
                    this.pathSegTypeAsLetter = typeAsLetter;
                    this._owningPathSegList = owningPathSegList;
                };
                window.SVGPathSeg.prototype.classname = "SVGPathSeg";
                window.SVGPathSeg.PATHSEG_UNKNOWN = 0;
                window.SVGPathSeg.PATHSEG_CLOSEPATH = 1;
                window.SVGPathSeg.PATHSEG_MOVETO_ABS = 2;
                window.SVGPathSeg.PATHSEG_MOVETO_REL = 3;
                window.SVGPathSeg.PATHSEG_LINETO_ABS = 4;
                window.SVGPathSeg.PATHSEG_LINETO_REL = 5;
                window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS = 6;
                window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL = 7;
                window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS = 8;
                window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL = 9;
                window.SVGPathSeg.PATHSEG_ARC_ABS = 10;
                window.SVGPathSeg.PATHSEG_ARC_REL = 11;
                window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS = 12;
                window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL = 13;
                window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS = 14;
                window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL = 15;
                window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS = 16;
                window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL = 17;
                window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS = 18;
                window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL = 19;
                window.SVGPathSeg.prototype._segmentChanged = function () {
                    if (this._owningPathSegList)
                        this._owningPathSegList.segmentChanged(this);
                };
                window.SVGPathSegClosePath = function (owningPathSegList) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CLOSEPATH, "z", owningPathSegList);
                };
                window.SVGPathSegClosePath.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegClosePath.prototype.toString = function () {
                    return "[object SVGPathSegClosePath]";
                };
                window.SVGPathSegClosePath.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter;
                };
                window.SVGPathSegClosePath.prototype.clone = function () {
                    return new window.SVGPathSegClosePath(undefined);
                };
                window.SVGPathSegMovetoAbs = function (owningPathSegList, x, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_MOVETO_ABS, "M", owningPathSegList);
                    this._x = x;
                    this._y = y;
                };
                window.SVGPathSegMovetoAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegMovetoAbs.prototype.toString = function () {
                    return "[object SVGPathSegMovetoAbs]";
                };
                window.SVGPathSegMovetoAbs.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
                };
                window.SVGPathSegMovetoAbs.prototype.clone = function () {
                    return new window.SVGPathSegMovetoAbs(undefined, this._x, this._y);
                };
                Object.defineProperty(window.SVGPathSegMovetoAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegMovetoAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegMovetoRel = function (owningPathSegList, x, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_MOVETO_REL, "m", owningPathSegList);
                    this._x = x;
                    this._y = y;
                };
                window.SVGPathSegMovetoRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegMovetoRel.prototype.toString = function () {
                    return "[object SVGPathSegMovetoRel]";
                };
                window.SVGPathSegMovetoRel.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
                };
                window.SVGPathSegMovetoRel.prototype.clone = function () {
                    return new window.SVGPathSegMovetoRel(undefined, this._x, this._y);
                };
                Object.defineProperty(window.SVGPathSegMovetoRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegMovetoRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegLinetoAbs = function (owningPathSegList, x, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_ABS, "L", owningPathSegList);
                    this._x = x;
                    this._y = y;
                };
                window.SVGPathSegLinetoAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegLinetoAbs.prototype.toString = function () {
                    return "[object SVGPathSegLinetoAbs]";
                };
                window.SVGPathSegLinetoAbs.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
                };
                window.SVGPathSegLinetoAbs.prototype.clone = function () {
                    return new window.SVGPathSegLinetoAbs(undefined, this._x, this._y);
                };
                Object.defineProperty(window.SVGPathSegLinetoAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegLinetoAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegLinetoRel = function (owningPathSegList, x, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_REL, "l", owningPathSegList);
                    this._x = x;
                    this._y = y;
                };
                window.SVGPathSegLinetoRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegLinetoRel.prototype.toString = function () {
                    return "[object SVGPathSegLinetoRel]";
                };
                window.SVGPathSegLinetoRel.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
                };
                window.SVGPathSegLinetoRel.prototype.clone = function () {
                    return new window.SVGPathSegLinetoRel(undefined, this._x, this._y);
                };
                Object.defineProperty(window.SVGPathSegLinetoRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegLinetoRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoCubicAbs = function (owningPathSegList, x, y, x1, y1, x2, y2) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS, "C", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._x1 = x1;
                    this._y1 = y1;
                    this._x2 = x2;
                    this._y2 = y2;
                };
                window.SVGPathSegCurvetoCubicAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoCubicAbs.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoCubicAbs]";
                };
                window.SVGPathSegCurvetoCubicAbs.prototype._asPathString = function () {
                    return (this.pathSegTypeAsLetter +
                        " " +
                        this._x1 +
                        " " +
                        this._y1 +
                        " " +
                        this._x2 +
                        " " +
                        this._y2 +
                        " " +
                        this._x +
                        " " +
                        this._y);
                };
                window.SVGPathSegCurvetoCubicAbs.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoCubicAbs(undefined, this._x, this._y, this._x1, this._y1, this._x2, this._y2);
                };
                Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "x1", {
                    get: function () {
                        return this._x1;
                    },
                    set: function (x1) {
                        this._x1 = x1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "y1", {
                    get: function () {
                        return this._y1;
                    },
                    set: function (y1) {
                        this._y1 = y1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "x2", {
                    get: function () {
                        return this._x2;
                    },
                    set: function (x2) {
                        this._x2 = x2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "y2", {
                    get: function () {
                        return this._y2;
                    },
                    set: function (y2) {
                        this._y2 = y2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoCubicRel = function (owningPathSegList, x, y, x1, y1, x2, y2) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL, "c", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._x1 = x1;
                    this._y1 = y1;
                    this._x2 = x2;
                    this._y2 = y2;
                };
                window.SVGPathSegCurvetoCubicRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoCubicRel.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoCubicRel]";
                };
                window.SVGPathSegCurvetoCubicRel.prototype._asPathString = function () {
                    return (this.pathSegTypeAsLetter +
                        " " +
                        this._x1 +
                        " " +
                        this._y1 +
                        " " +
                        this._x2 +
                        " " +
                        this._y2 +
                        " " +
                        this._x +
                        " " +
                        this._y);
                };
                window.SVGPathSegCurvetoCubicRel.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoCubicRel(undefined, this._x, this._y, this._x1, this._y1, this._x2, this._y2);
                };
                Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "x1", {
                    get: function () {
                        return this._x1;
                    },
                    set: function (x1) {
                        this._x1 = x1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "y1", {
                    get: function () {
                        return this._y1;
                    },
                    set: function (y1) {
                        this._y1 = y1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "x2", {
                    get: function () {
                        return this._x2;
                    },
                    set: function (x2) {
                        this._x2 = x2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "y2", {
                    get: function () {
                        return this._y2;
                    },
                    set: function (y2) {
                        this._y2 = y2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoQuadraticAbs = function (owningPathSegList, x, y, x1, y1) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS, "Q", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._x1 = x1;
                    this._y1 = y1;
                };
                window.SVGPathSegCurvetoQuadraticAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoQuadraticAbs.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoQuadraticAbs]";
                };
                window.SVGPathSegCurvetoQuadraticAbs.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x + " " + this._y;
                };
                window.SVGPathSegCurvetoQuadraticAbs.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoQuadraticAbs(undefined, this._x, this._y, this._x1, this._y1);
                };
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "x1", {
                    get: function () {
                        return this._x1;
                    },
                    set: function (x1) {
                        this._x1 = x1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "y1", {
                    get: function () {
                        return this._y1;
                    },
                    set: function (y1) {
                        this._y1 = y1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoQuadraticRel = function (owningPathSegList, x, y, x1, y1) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL, "q", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._x1 = x1;
                    this._y1 = y1;
                };
                window.SVGPathSegCurvetoQuadraticRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoQuadraticRel.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoQuadraticRel]";
                };
                window.SVGPathSegCurvetoQuadraticRel.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x + " " + this._y;
                };
                window.SVGPathSegCurvetoQuadraticRel.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoQuadraticRel(undefined, this._x, this._y, this._x1, this._y1);
                };
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "x1", {
                    get: function () {
                        return this._x1;
                    },
                    set: function (x1) {
                        this._x1 = x1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "y1", {
                    get: function () {
                        return this._y1;
                    },
                    set: function (y1) {
                        this._y1 = y1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegArcAbs = function (owningPathSegList, x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_ARC_ABS, "A", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._r1 = r1;
                    this._r2 = r2;
                    this._angle = angle;
                    this._largeArcFlag = largeArcFlag;
                    this._sweepFlag = sweepFlag;
                };
                window.SVGPathSegArcAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegArcAbs.prototype.toString = function () {
                    return "[object SVGPathSegArcAbs]";
                };
                window.SVGPathSegArcAbs.prototype._asPathString = function () {
                    return (this.pathSegTypeAsLetter +
                        " " +
                        this._r1 +
                        " " +
                        this._r2 +
                        " " +
                        this._angle +
                        " " +
                        (this._largeArcFlag ? "1" : "0") +
                        " " +
                        (this._sweepFlag ? "1" : "0") +
                        " " +
                        this._x +
                        " " +
                        this._y);
                };
                window.SVGPathSegArcAbs.prototype.clone = function () {
                    return new window.SVGPathSegArcAbs(undefined, this._x, this._y, this._r1, this._r2, this._angle, this._largeArcFlag, this._sweepFlag);
                };
                Object.defineProperty(window.SVGPathSegArcAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcAbs.prototype, "r1", {
                    get: function () {
                        return this._r1;
                    },
                    set: function (r1) {
                        this._r1 = r1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcAbs.prototype, "r2", {
                    get: function () {
                        return this._r2;
                    },
                    set: function (r2) {
                        this._r2 = r2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcAbs.prototype, "angle", {
                    get: function () {
                        return this._angle;
                    },
                    set: function (angle) {
                        this._angle = angle;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcAbs.prototype, "largeArcFlag", {
                    get: function () {
                        return this._largeArcFlag;
                    },
                    set: function (largeArcFlag) {
                        this._largeArcFlag = largeArcFlag;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcAbs.prototype, "sweepFlag", {
                    get: function () {
                        return this._sweepFlag;
                    },
                    set: function (sweepFlag) {
                        this._sweepFlag = sweepFlag;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegArcRel = function (owningPathSegList, x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_ARC_REL, "a", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._r1 = r1;
                    this._r2 = r2;
                    this._angle = angle;
                    this._largeArcFlag = largeArcFlag;
                    this._sweepFlag = sweepFlag;
                };
                window.SVGPathSegArcRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegArcRel.prototype.toString = function () {
                    return "[object SVGPathSegArcRel]";
                };
                window.SVGPathSegArcRel.prototype._asPathString = function () {
                    return (this.pathSegTypeAsLetter +
                        " " +
                        this._r1 +
                        " " +
                        this._r2 +
                        " " +
                        this._angle +
                        " " +
                        (this._largeArcFlag ? "1" : "0") +
                        " " +
                        (this._sweepFlag ? "1" : "0") +
                        " " +
                        this._x +
                        " " +
                        this._y);
                };
                window.SVGPathSegArcRel.prototype.clone = function () {
                    return new window.SVGPathSegArcRel(undefined, this._x, this._y, this._r1, this._r2, this._angle, this._largeArcFlag, this._sweepFlag);
                };
                Object.defineProperty(window.SVGPathSegArcRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcRel.prototype, "r1", {
                    get: function () {
                        return this._r1;
                    },
                    set: function (r1) {
                        this._r1 = r1;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcRel.prototype, "r2", {
                    get: function () {
                        return this._r2;
                    },
                    set: function (r2) {
                        this._r2 = r2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcRel.prototype, "angle", {
                    get: function () {
                        return this._angle;
                    },
                    set: function (angle) {
                        this._angle = angle;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcRel.prototype, "largeArcFlag", {
                    get: function () {
                        return this._largeArcFlag;
                    },
                    set: function (largeArcFlag) {
                        this._largeArcFlag = largeArcFlag;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegArcRel.prototype, "sweepFlag", {
                    get: function () {
                        return this._sweepFlag;
                    },
                    set: function (sweepFlag) {
                        this._sweepFlag = sweepFlag;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegLinetoHorizontalAbs = function (owningPathSegList, x) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS, "H", owningPathSegList);
                    this._x = x;
                };
                window.SVGPathSegLinetoHorizontalAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegLinetoHorizontalAbs.prototype.toString = function () {
                    return "[object SVGPathSegLinetoHorizontalAbs]";
                };
                window.SVGPathSegLinetoHorizontalAbs.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x;
                };
                window.SVGPathSegLinetoHorizontalAbs.prototype.clone = function () {
                    return new window.SVGPathSegLinetoHorizontalAbs(undefined, this._x);
                };
                Object.defineProperty(window.SVGPathSegLinetoHorizontalAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegLinetoHorizontalRel = function (owningPathSegList, x) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL, "h", owningPathSegList);
                    this._x = x;
                };
                window.SVGPathSegLinetoHorizontalRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegLinetoHorizontalRel.prototype.toString = function () {
                    return "[object SVGPathSegLinetoHorizontalRel]";
                };
                window.SVGPathSegLinetoHorizontalRel.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x;
                };
                window.SVGPathSegLinetoHorizontalRel.prototype.clone = function () {
                    return new window.SVGPathSegLinetoHorizontalRel(undefined, this._x);
                };
                Object.defineProperty(window.SVGPathSegLinetoHorizontalRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegLinetoVerticalAbs = function (owningPathSegList, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS, "V", owningPathSegList);
                    this._y = y;
                };
                window.SVGPathSegLinetoVerticalAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegLinetoVerticalAbs.prototype.toString = function () {
                    return "[object SVGPathSegLinetoVerticalAbs]";
                };
                window.SVGPathSegLinetoVerticalAbs.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._y;
                };
                window.SVGPathSegLinetoVerticalAbs.prototype.clone = function () {
                    return new window.SVGPathSegLinetoVerticalAbs(undefined, this._y);
                };
                Object.defineProperty(window.SVGPathSegLinetoVerticalAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegLinetoVerticalRel = function (owningPathSegList, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL, "v", owningPathSegList);
                    this._y = y;
                };
                window.SVGPathSegLinetoVerticalRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegLinetoVerticalRel.prototype.toString = function () {
                    return "[object SVGPathSegLinetoVerticalRel]";
                };
                window.SVGPathSegLinetoVerticalRel.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._y;
                };
                window.SVGPathSegLinetoVerticalRel.prototype.clone = function () {
                    return new window.SVGPathSegLinetoVerticalRel(undefined, this._y);
                };
                Object.defineProperty(window.SVGPathSegLinetoVerticalRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoCubicSmoothAbs = function (owningPathSegList, x, y, x2, y2) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS, "S", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._x2 = x2;
                    this._y2 = y2;
                };
                window.SVGPathSegCurvetoCubicSmoothAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoCubicSmoothAbs.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoCubicSmoothAbs]";
                };
                window.SVGPathSegCurvetoCubicSmoothAbs.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y;
                };
                window.SVGPathSegCurvetoCubicSmoothAbs.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoCubicSmoothAbs(undefined, this._x, this._y, this._x2, this._y2);
                };
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "x2", {
                    get: function () {
                        return this._x2;
                    },
                    set: function (x2) {
                        this._x2 = x2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "y2", {
                    get: function () {
                        return this._y2;
                    },
                    set: function (y2) {
                        this._y2 = y2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoCubicSmoothRel = function (owningPathSegList, x, y, x2, y2) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL, "s", owningPathSegList);
                    this._x = x;
                    this._y = y;
                    this._x2 = x2;
                    this._y2 = y2;
                };
                window.SVGPathSegCurvetoCubicSmoothRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoCubicSmoothRel.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoCubicSmoothRel]";
                };
                window.SVGPathSegCurvetoCubicSmoothRel.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y;
                };
                window.SVGPathSegCurvetoCubicSmoothRel.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoCubicSmoothRel(undefined, this._x, this._y, this._x2, this._y2);
                };
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "x2", {
                    get: function () {
                        return this._x2;
                    },
                    set: function (x2) {
                        this._x2 = x2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "y2", {
                    get: function () {
                        return this._y2;
                    },
                    set: function (y2) {
                        this._y2 = y2;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoQuadraticSmoothAbs = function (owningPathSegList, x, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS, "T", owningPathSegList);
                    this._x = x;
                    this._y = y;
                };
                window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoQuadraticSmoothAbs]";
                };
                window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
                };
                window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoQuadraticSmoothAbs(undefined, this._x, this._y);
                };
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathSegCurvetoQuadraticSmoothRel = function (owningPathSegList, x, y) {
                    window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL, "t", owningPathSegList);
                    this._x = x;
                    this._y = y;
                };
                window.SVGPathSegCurvetoQuadraticSmoothRel.prototype = Object.create(window.SVGPathSeg.prototype);
                window.SVGPathSegCurvetoQuadraticSmoothRel.prototype.toString = function () {
                    return "[object SVGPathSegCurvetoQuadraticSmoothRel]";
                };
                window.SVGPathSegCurvetoQuadraticSmoothRel.prototype._asPathString = function () {
                    return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
                };
                window.SVGPathSegCurvetoQuadraticSmoothRel.prototype.clone = function () {
                    return new window.SVGPathSegCurvetoQuadraticSmoothRel(undefined, this._x, this._y);
                };
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothRel.prototype, "x", {
                    get: function () {
                        return this._x;
                    },
                    set: function (x) {
                        this._x = x;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothRel.prototype, "y", {
                    get: function () {
                        return this._y;
                    },
                    set: function (y) {
                        this._y = y;
                        this._segmentChanged();
                    },
                    enumerable: true,
                });
                window.SVGPathElement.prototype.createSVGPathSegClosePath = function () {
                    return new window.SVGPathSegClosePath(undefined);
                };
                window.SVGPathElement.prototype.createSVGPathSegMovetoAbs = function (x, y) {
                    return new window.SVGPathSegMovetoAbs(undefined, x, y);
                };
                window.SVGPathElement.prototype.createSVGPathSegMovetoRel = function (x, y) {
                    return new window.SVGPathSegMovetoRel(undefined, x, y);
                };
                window.SVGPathElement.prototype.createSVGPathSegLinetoAbs = function (x, y) {
                    return new window.SVGPathSegLinetoAbs(undefined, x, y);
                };
                window.SVGPathElement.prototype.createSVGPathSegLinetoRel = function (x, y) {
                    return new window.SVGPathSegLinetoRel(undefined, x, y);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicAbs = function (x, y, x1, y1, x2, y2) {
                    return new window.SVGPathSegCurvetoCubicAbs(undefined, x, y, x1, y1, x2, y2);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicRel = function (x, y, x1, y1, x2, y2) {
                    return new window.SVGPathSegCurvetoCubicRel(undefined, x, y, x1, y1, x2, y2);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticAbs = function (x, y, x1, y1) {
                    return new window.SVGPathSegCurvetoQuadraticAbs(undefined, x, y, x1, y1);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticRel = function (x, y, x1, y1) {
                    return new window.SVGPathSegCurvetoQuadraticRel(undefined, x, y, x1, y1);
                };
                window.SVGPathElement.prototype.createSVGPathSegArcAbs = function (x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
                    return new window.SVGPathSegArcAbs(undefined, x, y, r1, r2, angle, largeArcFlag, sweepFlag);
                };
                window.SVGPathElement.prototype.createSVGPathSegArcRel = function (x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
                    return new window.SVGPathSegArcRel(undefined, x, y, r1, r2, angle, largeArcFlag, sweepFlag);
                };
                window.SVGPathElement.prototype.createSVGPathSegLinetoHorizontalAbs = function (x) {
                    return new window.SVGPathSegLinetoHorizontalAbs(undefined, x);
                };
                window.SVGPathElement.prototype.createSVGPathSegLinetoHorizontalRel = function (x) {
                    return new window.SVGPathSegLinetoHorizontalRel(undefined, x);
                };
                window.SVGPathElement.prototype.createSVGPathSegLinetoVerticalAbs = function (y) {
                    return new window.SVGPathSegLinetoVerticalAbs(undefined, y);
                };
                window.SVGPathElement.prototype.createSVGPathSegLinetoVerticalRel = function (y) {
                    return new window.SVGPathSegLinetoVerticalRel(undefined, y);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothAbs = function (x, y, x2, y2) {
                    return new window.SVGPathSegCurvetoCubicSmoothAbs(undefined, x, y, x2, y2);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothRel = function (x, y, x2, y2) {
                    return new window.SVGPathSegCurvetoCubicSmoothRel(undefined, x, y, x2, y2);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothAbs = function (x, y) {
                    return new window.SVGPathSegCurvetoQuadraticSmoothAbs(undefined, x, y);
                };
                window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothRel = function (x, y) {
                    return new window.SVGPathSegCurvetoQuadraticSmoothRel(undefined, x, y);
                };
                if (!("getPathSegAtLength" in window.SVGPathElement.prototype)) {
                    window.SVGPathElement.prototype.getPathSegAtLength = function (distance) {
                        if (distance === undefined || !isFinite(distance))
                            throw "Invalid arguments.";
                        const measurementElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        measurementElement.setAttribute("d", this.getAttribute("d"));
                        let lastPathSegment = measurementElement.pathSegList.numberOfItems - 1;
                        if (lastPathSegment <= 0)
                            return 0;
                        do {
                            measurementElement.pathSegList.removeItem(lastPathSegment);
                            if (distance > measurementElement.getTotalLength())
                                break;
                            lastPathSegment--;
                        } while (lastPathSegment > 0);
                        return lastPathSegment;
                    };
                }
            }
            if (!("SVGPathSegList" in window) || !("appendItem" in window.SVGPathSegList.prototype)) {
                window.SVGPathSegList = function (pathElement) {
                    this._pathElement = pathElement;
                    this._list = this._parsePath(this._pathElement.getAttribute("d"));
                    this._mutationObserverConfig = { attributes: true, attributeFilter: ["d"] };
                    this._pathElementMutationObserver = new MutationObserver(this._updateListFromPathMutations.bind(this));
                    this._pathElementMutationObserver.observe(this._pathElement, this._mutationObserverConfig);
                };
                window.SVGPathSegList.prototype.classname = "SVGPathSegList";
                Object.defineProperty(window.SVGPathSegList.prototype, "numberOfItems", {
                    get: function () {
                        this._checkPathSynchronizedToList();
                        return this._list.length;
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathSegList.prototype, "length", {
                    get: function () {
                        this._checkPathSynchronizedToList();
                        return this._list.length;
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathElement.prototype, "pathSegList", {
                    get: function () {
                        if (!this._pathSegList)
                            this._pathSegList = new window.SVGPathSegList(this);
                        return this._pathSegList;
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathElement.prototype, "normalizedPathSegList", {
                    get: function () {
                        return this.pathSegList;
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathElement.prototype, "animatedPathSegList", {
                    get: function () {
                        return this.pathSegList;
                    },
                    enumerable: true,
                });
                Object.defineProperty(window.SVGPathElement.prototype, "animatedNormalizedPathSegList", {
                    get: function () {
                        return this.pathSegList;
                    },
                    enumerable: true,
                });
                window.SVGPathSegList.prototype._checkPathSynchronizedToList = function () {
                    this._updateListFromPathMutations(this._pathElementMutationObserver.takeRecords());
                };
                window.SVGPathSegList.prototype._updateListFromPathMutations = function (mutationRecords) {
                    if (!this._pathElement)
                        return;
                    let hasPathMutations = false;
                    mutationRecords.forEach(function (record) {
                        if (record.attributeName == "d")
                            hasPathMutations = true;
                    });
                    if (hasPathMutations)
                        this._list = this._parsePath(this._pathElement.getAttribute("d"));
                };
                window.SVGPathSegList.prototype._writeListToPath = function () {
                    this._pathElementMutationObserver.disconnect();
                    this._pathElement.setAttribute("d", window.SVGPathSegList._pathSegArrayAsString(this._list));
                    this._pathElementMutationObserver.observe(this._pathElement, this._mutationObserverConfig);
                };
                window.SVGPathSegList.prototype.segmentChanged = function (pathSeg) {
                    this._writeListToPath();
                };
                window.SVGPathSegList.prototype.clear = function () {
                    this._checkPathSynchronizedToList();
                    this._list.forEach(function (pathSeg) {
                        pathSeg._owningPathSegList = null;
                    });
                    this._list = [];
                    this._writeListToPath();
                };
                window.SVGPathSegList.prototype.initialize = function (newItem) {
                    this._checkPathSynchronizedToList();
                    this._list = [newItem];
                    newItem._owningPathSegList = this;
                    this._writeListToPath();
                    return newItem;
                };
                window.SVGPathSegList.prototype._checkValidIndex = function (index) {
                    if (isNaN(index) || index < 0 || index >= this.numberOfItems)
                        throw "INDEX_SIZE_ERR";
                };
                window.SVGPathSegList.prototype.getItem = function (index) {
                    this._checkPathSynchronizedToList();
                    this._checkValidIndex(index);
                    return this._list[index];
                };
                window.SVGPathSegList.prototype.insertItemBefore = function (newItem, index) {
                    this._checkPathSynchronizedToList();
                    if (index > this.numberOfItems)
                        index = this.numberOfItems;
                    if (newItem._owningPathSegList) {
                        newItem = newItem.clone();
                    }
                    this._list.splice(index, 0, newItem);
                    newItem._owningPathSegList = this;
                    this._writeListToPath();
                    return newItem;
                };
                window.SVGPathSegList.prototype.replaceItem = function (newItem, index) {
                    this._checkPathSynchronizedToList();
                    if (newItem._owningPathSegList) {
                        newItem = newItem.clone();
                    }
                    this._checkValidIndex(index);
                    this._list[index] = newItem;
                    newItem._owningPathSegList = this;
                    this._writeListToPath();
                    return newItem;
                };
                window.SVGPathSegList.prototype.removeItem = function (index) {
                    this._checkPathSynchronizedToList();
                    this._checkValidIndex(index);
                    const item = this._list[index];
                    this._list.splice(index, 1);
                    this._writeListToPath();
                    return item;
                };
                window.SVGPathSegList.prototype.appendItem = function (newItem) {
                    this._checkPathSynchronizedToList();
                    if (newItem._owningPathSegList) {
                        newItem = newItem.clone();
                    }
                    this._list.push(newItem);
                    newItem._owningPathSegList = this;
                    this._writeListToPath();
                    return newItem;
                };
                window.SVGPathSegList._pathSegArrayAsString = function (pathSegArray) {
                    let string = "";
                    let first = true;
                    pathSegArray.forEach(function (pathSeg) {
                        if (first) {
                            first = false;
                            string += pathSeg._asPathString();
                        }
                        else {
                            string += " " + pathSeg._asPathString();
                        }
                    });
                    return string;
                };
                window.SVGPathSegList.prototype._parsePath = function (string) {
                    if (!string || string.length == 0)
                        return [];
                    const owningPathSegList = this;
                    const Builder = function () {
                        this.pathSegList = [];
                    };
                    Builder.prototype.appendSegment = function (pathSeg) {
                        this.pathSegList.push(pathSeg);
                    };
                    const Source = function (string) {
                        this._string = string;
                        this._currentIndex = 0;
                        this._endIndex = this._string.length;
                        this._previousCommand = window.SVGPathSeg.PATHSEG_UNKNOWN;
                        this._skipOptionalSpaces();
                    };
                    Source.prototype._isCurrentSpace = function () {
                        const character = this._string[this._currentIndex];
                        return (character <= " " &&
                            (character == " " || character == "\n" || character == "\t" || character == "\r" || character == "\f"));
                    };
                    Source.prototype._skipOptionalSpaces = function () {
                        while (this._currentIndex < this._endIndex && this._isCurrentSpace())
                            this._currentIndex++;
                        return this._currentIndex < this._endIndex;
                    };
                    Source.prototype._skipOptionalSpacesOrDelimiter = function () {
                        if (this._currentIndex < this._endIndex &&
                            !this._isCurrentSpace() &&
                            this._string.charAt(this._currentIndex) != ",")
                            return false;
                        if (this._skipOptionalSpaces()) {
                            if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == ",") {
                                this._currentIndex++;
                                this._skipOptionalSpaces();
                            }
                        }
                        return this._currentIndex < this._endIndex;
                    };
                    Source.prototype.hasMoreData = function () {
                        return this._currentIndex < this._endIndex;
                    };
                    Source.prototype.peekSegmentType = function () {
                        const lookahead = this._string[this._currentIndex];
                        return this._pathSegTypeFromChar(lookahead);
                    };
                    Source.prototype._pathSegTypeFromChar = function (lookahead) {
                        switch (lookahead) {
                            case "Z":
                            case "z":
                                return window.SVGPathSeg.PATHSEG_CLOSEPATH;
                            case "M":
                                return window.SVGPathSeg.PATHSEG_MOVETO_ABS;
                            case "m":
                                return window.SVGPathSeg.PATHSEG_MOVETO_REL;
                            case "L":
                                return window.SVGPathSeg.PATHSEG_LINETO_ABS;
                            case "l":
                                return window.SVGPathSeg.PATHSEG_LINETO_REL;
                            case "C":
                                return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS;
                            case "c":
                                return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL;
                            case "Q":
                                return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS;
                            case "q":
                                return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL;
                            case "A":
                                return window.SVGPathSeg.PATHSEG_ARC_ABS;
                            case "a":
                                return window.SVGPathSeg.PATHSEG_ARC_REL;
                            case "H":
                                return window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS;
                            case "h":
                                return window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL;
                            case "V":
                                return window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS;
                            case "v":
                                return window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL;
                            case "S":
                                return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS;
                            case "s":
                                return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL;
                            case "T":
                                return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS;
                            case "t":
                                return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL;
                            default:
                                return window.SVGPathSeg.PATHSEG_UNKNOWN;
                        }
                    };
                    Source.prototype._nextCommandHelper = function (lookahead, previousCommand) {
                        if ((lookahead == "+" || lookahead == "-" || lookahead == "." || (lookahead >= "0" && lookahead <= "9")) &&
                            previousCommand != window.SVGPathSeg.PATHSEG_CLOSEPATH) {
                            if (previousCommand == window.SVGPathSeg.PATHSEG_MOVETO_ABS)
                                return window.SVGPathSeg.PATHSEG_LINETO_ABS;
                            if (previousCommand == window.SVGPathSeg.PATHSEG_MOVETO_REL)
                                return window.SVGPathSeg.PATHSEG_LINETO_REL;
                            return previousCommand;
                        }
                        return window.SVGPathSeg.PATHSEG_UNKNOWN;
                    };
                    Source.prototype.initialCommandIsMoveTo = function () {
                        if (!this.hasMoreData())
                            return true;
                        const command = this.peekSegmentType();
                        return command == window.SVGPathSeg.PATHSEG_MOVETO_ABS || command == window.SVGPathSeg.PATHSEG_MOVETO_REL;
                    };
                    Source.prototype._parseNumber = function () {
                        let exponent = 0;
                        let integer = 0;
                        let frac = 1;
                        let decimal = 0;
                        let sign = 1;
                        let expsign = 1;
                        const startIndex = this._currentIndex;
                        this._skipOptionalSpaces();
                        if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == "+")
                            this._currentIndex++;
                        else if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == "-") {
                            this._currentIndex++;
                            sign = -1;
                        }
                        if (this._currentIndex == this._endIndex ||
                            ((this._string.charAt(this._currentIndex) < "0" || this._string.charAt(this._currentIndex) > "9") &&
                                this._string.charAt(this._currentIndex) != "."))
                            return undefined;
                        const startIntPartIndex = this._currentIndex;
                        while (this._currentIndex < this._endIndex &&
                            this._string.charAt(this._currentIndex) >= "0" &&
                            this._string.charAt(this._currentIndex) <= "9")
                            this._currentIndex++;
                        if (this._currentIndex != startIntPartIndex) {
                            let scanIntPartIndex = this._currentIndex - 1;
                            let multiplier = 1;
                            while (scanIntPartIndex >= startIntPartIndex) {
                                integer += multiplier * (this._string.charAt(scanIntPartIndex--) - "0");
                                multiplier *= 10;
                            }
                        }
                        if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == ".") {
                            this._currentIndex++;
                            if (this._currentIndex >= this._endIndex ||
                                this._string.charAt(this._currentIndex) < "0" ||
                                this._string.charAt(this._currentIndex) > "9")
                                return undefined;
                            while (this._currentIndex < this._endIndex &&
                                this._string.charAt(this._currentIndex) >= "0" &&
                                this._string.charAt(this._currentIndex) <= "9") {
                                frac *= 10;
                                decimal += (this._string.charAt(this._currentIndex) - "0") / frac;
                                this._currentIndex += 1;
                            }
                        }
                        if (this._currentIndex != startIndex &&
                            this._currentIndex + 1 < this._endIndex &&
                            (this._string.charAt(this._currentIndex) == "e" || this._string.charAt(this._currentIndex) == "E") &&
                            this._string.charAt(this._currentIndex + 1) != "x" &&
                            this._string.charAt(this._currentIndex + 1) != "m") {
                            this._currentIndex++;
                            if (this._string.charAt(this._currentIndex) == "+") {
                                this._currentIndex++;
                            }
                            else if (this._string.charAt(this._currentIndex) == "-") {
                                this._currentIndex++;
                                expsign = -1;
                            }
                            if (this._currentIndex >= this._endIndex ||
                                this._string.charAt(this._currentIndex) < "0" ||
                                this._string.charAt(this._currentIndex) > "9")
                                return undefined;
                            while (this._currentIndex < this._endIndex &&
                                this._string.charAt(this._currentIndex) >= "0" &&
                                this._string.charAt(this._currentIndex) <= "9") {
                                exponent *= 10;
                                exponent += this._string.charAt(this._currentIndex) - "0";
                                this._currentIndex++;
                            }
                        }
                        let number = integer + decimal;
                        number *= sign;
                        if (exponent)
                            number *= Math.pow(10, expsign * exponent);
                        if (startIndex == this._currentIndex)
                            return undefined;
                        this._skipOptionalSpacesOrDelimiter();
                        return number;
                    };
                    Source.prototype._parseArcFlag = function () {
                        if (this._currentIndex >= this._endIndex)
                            return undefined;
                        let flag = false;
                        const flagChar = this._string.charAt(this._currentIndex++);
                        if (flagChar == "0")
                            flag = false;
                        else if (flagChar == "1")
                            flag = true;
                        else
                            return undefined;
                        this._skipOptionalSpacesOrDelimiter();
                        return flag;
                    };
                    Source.prototype.parseSegment = function () {
                        const lookahead = this._string[this._currentIndex];
                        let command = this._pathSegTypeFromChar(lookahead);
                        if (command == window.SVGPathSeg.PATHSEG_UNKNOWN) {
                            if (this._previousCommand == window.SVGPathSeg.PATHSEG_UNKNOWN)
                                return null;
                            command = this._nextCommandHelper(lookahead, this._previousCommand);
                            if (command == window.SVGPathSeg.PATHSEG_UNKNOWN)
                                return null;
                        }
                        else {
                            this._currentIndex++;
                        }
                        this._previousCommand = command;
                        let points;
                        switch (command) {
                            case window.SVGPathSeg.PATHSEG_MOVETO_REL:
                                return new window.SVGPathSegMovetoRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_MOVETO_ABS:
                                return new window.SVGPathSegMovetoAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_LINETO_REL:
                                return new window.SVGPathSegLinetoRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_LINETO_ABS:
                                return new window.SVGPathSegLinetoAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL:
                                return new window.SVGPathSegLinetoHorizontalRel(owningPathSegList, this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS:
                                return new window.SVGPathSegLinetoHorizontalAbs(owningPathSegList, this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL:
                                return new window.SVGPathSegLinetoVerticalRel(owningPathSegList, this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS:
                                return new window.SVGPathSegLinetoVerticalAbs(owningPathSegList, this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_CLOSEPATH:
                                this._skipOptionalSpaces();
                                return new window.SVGPathSegClosePath(owningPathSegList);
                            case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL:
                                points = {
                                    x1: this._parseNumber(),
                                    y1: this._parseNumber(),
                                    x2: this._parseNumber(),
                                    y2: this._parseNumber(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegCurvetoCubicRel(owningPathSegList, points.x, points.y, points.x1, points.y1, points.x2, points.y2);
                            case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS:
                                points = {
                                    x1: this._parseNumber(),
                                    y1: this._parseNumber(),
                                    x2: this._parseNumber(),
                                    y2: this._parseNumber(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegCurvetoCubicAbs(owningPathSegList, points.x, points.y, points.x1, points.y1, points.x2, points.y2);
                            case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL:
                                points = {
                                    x2: this._parseNumber(),
                                    y2: this._parseNumber(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegCurvetoCubicSmoothRel(owningPathSegList, points.x, points.y, points.x2, points.y2);
                            case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS:
                                points = {
                                    x2: this._parseNumber(),
                                    y2: this._parseNumber(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegCurvetoCubicSmoothAbs(owningPathSegList, points.x, points.y, points.x2, points.y2);
                            case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL:
                                points = {
                                    x1: this._parseNumber(),
                                    y1: this._parseNumber(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegCurvetoQuadraticRel(owningPathSegList, points.x, points.y, points.x1, points.y1);
                            case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS:
                                points = {
                                    x1: this._parseNumber(),
                                    y1: this._parseNumber(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegCurvetoQuadraticAbs(owningPathSegList, points.x, points.y, points.x1, points.y1);
                            case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL:
                                return new window.SVGPathSegCurvetoQuadraticSmoothRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS:
                                return new window.SVGPathSegCurvetoQuadraticSmoothAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                            case window.SVGPathSeg.PATHSEG_ARC_REL:
                                points = {
                                    x1: this._parseNumber(),
                                    y1: this._parseNumber(),
                                    arcAngle: this._parseNumber(),
                                    arcLarge: this._parseArcFlag(),
                                    arcSweep: this._parseArcFlag(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegArcRel(owningPathSegList, points.x, points.y, points.x1, points.y1, points.arcAngle, points.arcLarge, points.arcSweep);
                            case window.SVGPathSeg.PATHSEG_ARC_ABS:
                                points = {
                                    x1: this._parseNumber(),
                                    y1: this._parseNumber(),
                                    arcAngle: this._parseNumber(),
                                    arcLarge: this._parseArcFlag(),
                                    arcSweep: this._parseArcFlag(),
                                    x: this._parseNumber(),
                                    y: this._parseNumber(),
                                };
                                return new window.SVGPathSegArcAbs(owningPathSegList, points.x, points.y, points.x1, points.y1, points.arcAngle, points.arcLarge, points.arcSweep);
                            default:
                                throw "Unknown path seg type.";
                        }
                    };
                    const builder = new Builder();
                    const source = new Source(string);
                    if (!source.initialCommandIsMoveTo())
                        return [];
                    while (source.hasMoreData()) {
                        const pathSeg = source.parseSegment();
                        if (!pathSeg)
                            return [];
                        builder.appendSegment(pathSeg);
                    }
                    return builder.pathSegList;
                };
            }
        }
        catch (e) {
            console.warn("An error occurred in tsParticles pathseg polyfill. If the Polygon Mask is not working, please open an issue here: https://github.com/matteobruni/tsparticles", e);
        }
    })();

    var pathseg = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
