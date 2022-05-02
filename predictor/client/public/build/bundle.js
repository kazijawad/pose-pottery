var app = (function () {
    'use strict';

    function noop() { }
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
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
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
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
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

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
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

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const output = writable(null);

    const mask = writable(null);

    function styleInject(css, ref) {
      if ( ref === void 0 ) ref = {};
      var insertAt = ref.insertAt;

      if (!css || typeof document === 'undefined') { return; }

      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.type = 'text/css';

      if (insertAt === 'top') {
        if (head.firstChild) {
          head.insertBefore(style, head.firstChild);
        } else {
          head.appendChild(style);
        }
      } else {
        head.appendChild(style);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
    }

    var css_248z$3 = "section.svelte-tsb9yl{display:flex;flex-direction:column;align-items:center;justify-content:center;grid-column:span 4;border:0.1rem solid var(--c-black)}video.svelte-tsb9yl{transform:rotateY(180deg)}canvas.svelte-tsb9yl{display:none}";
    styleInject(css_248z$3);

    /* src/components/poses.svelte generated by Svelte v3.48.0 */

    function create_fragment$3(ctx) {
    	let section;
    	let video_1;
    	let t1;
    	let canvas_1;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			section = element("section");
    			video_1 = element("video");

    			video_1.innerHTML = `Video stream not available.
        <track kind="captions"/>`;

    			t1 = space();
    			canvas_1 = element("canvas");
    			attr(video_1, "class", "svelte-tsb9yl");
    			attr(canvas_1, "class", "svelte-tsb9yl");
    			attr(section, "class", "svelte-tsb9yl");
    		},
    		m(target, anchor) {
    			insert(target, section, anchor);
    			append(section, video_1);
    			/*video_1_binding*/ ctx[4](video_1);
    			append(section, t1);
    			append(section, canvas_1);
    			/*canvas_1_binding*/ ctx[5](canvas_1);
    			/*section_binding*/ ctx[6](section);

    			if (!mounted) {
    				dispose = listen(video_1, "canplay", /*handleCanPlay*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(section);
    			/*video_1_binding*/ ctx[4](null);
    			/*canvas_1_binding*/ ctx[5](null);
    			/*section_binding*/ ctx[6](null);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    let width = 512;

    function instance$2($$self, $$props, $$invalidate) {
    	// left eye
    	// right eye
    	// left ear
    	// right ear
    	// left shoulder
    	// right shoulder
    	// left elbow
    	// right elbow
    	// left wrist
    	// right wrist
    	// left hip
    	// right hip
    	// left knee
    	// right knee
    	// left ankle
    	// right ankle

    	let camera;
    	let video;
    	let canvas;
    	let height = 0;
    	let streaming = false;

    	onMount(async () => {
    		try {
    			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    			$$invalidate(1, video.srcObject = stream, video);
    			video.play();
    		} catch(err) {
    			console.error(err);
    		}
    	});

    	function handleCanPlay() {
    		if (!streaming) {
    			height = video.videoHeight / (video.videoWidth / width);
    			video.setAttribute('width', '100%');
    			video.setAttribute('height', height);
    			canvas.setAttribute('width', '100%');
    			canvas.setAttribute('height', height);
    			streaming = true;
    			loop();
    		}
    	}

    	function loop() {
    		render().then(() => requestAnimationFrame(loop));
    	}

    	async function render() {
    		const context = canvas.getContext('2d');

    		if (height) {
    			$$invalidate(2, canvas.width = width, canvas);
    			$$invalidate(2, canvas.height = height, canvas);
    			context.drawImage(video, 0, 0, width, height);
    			const image = canvas.toDataURL('image/png');

    			let response = await fetch('http://localhost:5001/export', {
    				method: 'POST',
    				headers: { 'Content-Type': 'application/json' },
    				body: JSON.stringify({ image })
    			});

    			let data = await response.json();
    			mask.set(data.image);

    			response = await fetch('/predict', {
    				method: 'POST',
    				headers: { 'Content-Type': 'application/json' },
    				body: JSON.stringify({ image: data.image })
    			});

    			data = await response.json();
    			output.set(data.image);
    		} else {
    			output.set('assets/uv.png');
    		}
    	}

    	function video_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			video = $$value;
    			$$invalidate(1, video);
    		});
    	}

    	function canvas_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			canvas = $$value;
    			$$invalidate(2, canvas);
    		});
    	}

    	function section_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			camera = $$value;
    			$$invalidate(0, camera);
    		});
    	}

    	return [
    		camera,
    		video,
    		canvas,
    		handleCanPlay,
    		video_1_binding,
    		canvas_1_binding,
    		section_binding
    	];
    }

    class Poses extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, {});
    	}
    }

    var css_248z$2 = "section.svelte-5lhfcv{display:flex;flex-direction:column;align-items:center;justify-content:center;grid-column:span 4;border:0.1rem solid var(--c-black);border-left:none}img.svelte-5lhfcv{height:512px;width:100%;object-fit:contain}";
    styleInject(css_248z$2);

    /* src/components/mask.svelte generated by Svelte v3.48.0 */

    function create_fragment$2(ctx) {
    	let section;
    	let img;
    	let img_src_value;

    	return {
    		c() {
    			section = element("section");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "assets/uv.png")) attr(img, "src", img_src_value);
    			attr(img, "alt", "A generated pot will appear in this box.");
    			attr(img, "class", "svelte-5lhfcv");
    			attr(section, "class", "svelte-5lhfcv");
    		},
    		m(target, anchor) {
    			insert(target, section, anchor);
    			append(section, img);
    			/*img_binding*/ ctx[1](img);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(section);
    			/*img_binding*/ ctx[1](null);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let photo;

    	const unsubscribe = mask.subscribe(value => {
    		if (value) {
    			photo.setAttribute('src', value);
    		}
    	});

    	onDestroy(unsubscribe);

    	function img_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			photo = $$value;
    			$$invalidate(0, photo);
    		});
    	}

    	return [photo, img_binding];
    }

    class Mask extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, {});
    	}
    }

    var css_248z$1 = "section.svelte-5lhfcv{display:flex;flex-direction:column;align-items:center;justify-content:center;grid-column:span 4;border:0.1rem solid var(--c-black);border-left:none}img.svelte-5lhfcv{height:512px;width:100%;object-fit:contain}";
    styleInject(css_248z$1);

    /* src/components/output.svelte generated by Svelte v3.48.0 */

    function create_fragment$1(ctx) {
    	let section;
    	let img;
    	let img_src_value;

    	return {
    		c() {
    			section = element("section");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "assets/uv.png")) attr(img, "src", img_src_value);
    			attr(img, "alt", "A generated pot will appear in this box.");
    			attr(img, "class", "svelte-5lhfcv");
    			attr(section, "class", "svelte-5lhfcv");
    		},
    		m(target, anchor) {
    			insert(target, section, anchor);
    			append(section, img);
    			/*img_binding*/ ctx[1](img);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(section);
    			/*img_binding*/ ctx[1](null);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let photo;

    	const unsubscribe = output.subscribe(value => {
    		if (value) {
    			photo.setAttribute('src', value);
    		}
    	});

    	onDestroy(unsubscribe);

    	function img_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			photo = $$value;
    			$$invalidate(0, photo);
    		});
    	}

    	return [photo, img_binding];
    }

    class Output extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment$1, safe_not_equal, {});
    	}
    }

    var css_248z = "main.svelte-1xe02gh{display:grid;grid-template-columns:repeat(12, 1fr);height:100vh;padding:1rem;background-color:var(--c-off-white)}";
    styleInject(css_248z);

    /* src/app.svelte generated by Svelte v3.48.0 */

    function create_fragment(ctx) {
    	let main;
    	let poses;
    	let t0;
    	let mask;
    	let t1;
    	let output;
    	let current;
    	poses = new Poses({});
    	mask = new Mask({});
    	output = new Output({});

    	return {
    		c() {
    			main = element("main");
    			create_component(poses.$$.fragment);
    			t0 = space();
    			create_component(mask.$$.fragment);
    			t1 = space();
    			create_component(output.$$.fragment);
    			attr(main, "class", "svelte-1xe02gh");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			mount_component(poses, main, null);
    			append(main, t0);
    			mount_component(mask, main, null);
    			append(main, t1);
    			mount_component(output, main, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(poses.$$.fragment, local);
    			transition_in(mask.$$.fragment, local);
    			transition_in(output.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(poses.$$.fragment, local);
    			transition_out(mask.$$.fragment, local);
    			transition_out(output.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(poses);
    			destroy_component(mask);
    			destroy_component(output);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment, safe_not_equal, {});
    	}
    }

    var main = new App({ target: document.body });

    return main;

})();
