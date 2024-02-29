(function( $ ){

	var plugin_name = "dynatexer";   // Name of the plugin

	function nl2br (str, is_xhtml) {   
		var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';    
		return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1'+ breakTag);
	}

	function create_placeholder(content, data) {
		if (!content.placeholder_tag) {
			if (!content.placeholder || content.placeholder == '') {
				content.placeholder_tag = target;
			} else {
				placeholder_tag = $(content.placeholder);
				if (data.cursor && data.cursor.placeholder_tag) {
					content.placeholder_tag = placeholder_tag;
					content.placeholder_tag.insertBefore(data.cursor.placeholder_tag);
				} else {
					content.placeholder_tag = placeholder_tag;
					data.target.append(content.placeholder_tag);
				}
			}
		}
	}

	function assign_iterator(content) {
		if (!content.current_iterator) {
			content.current_iterator = render_strategies[content.render_strategy](content.items);
		}
	}

	function char_iterator(text) {
		this.current_char = 0;
		this.text = text;
	}

	char_iterator.prototype.has_next = function() {
		return this.current_char < this.text.length;
	}

	char_iterator.prototype.next = function() {
		var char = this.text.charAt(this.current_char++);
		if (char == '\r') {
			char = content.text.charAt(this.current_item++);
			if (char == '\n') {
				char = content.text.charAt(this.current_item++);
			}
			char = '<br />';
		} else if (char == '\n') {
			char = '<br />';
		}
		return char;
	}

	function one_shot_iterator(text) {
		this.listed = false;
		this.text = text;
	}

	one_shot_iterator.prototype.has_next = function() {
		return !this.listed;
	}

	one_shot_iterator.prototype.next = function() {
		this.listed = true;
		return nl2br(this.text);
	}

	function array_iterator(items) {
		this.current_item = 0;
		this.items = items;
	}

	array_iterator.prototype.has_next = function() {
		return this.current_item < this.items.length;
	}

	array_iterator.prototype.next = function() {
		return this.items[this.current_item++];
	}

	function line_iterator(text) {
		var lines = text.split(/\r\n|\r|\n/);
		this.delegate = new array_iterator(lines);
	}

	line_iterator.prototype.has_next = function() {
		return this.delegate.has_next();
	}

	line_iterator.prototype.next = function() {
		return (this.delegate.current_item != 0 ? '<br />' : '') + this.delegate.next();
	}

	function animate_content(data, content, finish_callback, strategy) {
		strategy.prepare();

		finish_callback = (typeof finish_callback === "undefined") ? function() {} : finish_callback;
		assign_iterator(content);

		content.current_iterator.has_next() ? animated = true : animated = false;

		var secuence = function() {
			if (data.running) {
				if (content.current_iterator.has_next()) {
					strategy.render();
					setTimeout(function() {
						if (data.running) {
							secuence();
						}
					}, content.delay);
				} else {
					finish_callback();
				}
			}
		}
		setTimeout(function() {
			secuence();
		}, 1);
		return animated;
	}

	var animations = {
		additive: function(data, content, finish_callback) {
			return animate_content(data, content, finish_callback, {
				prepare: function() {
					create_placeholder(content, data);
				},
				render: function() {
					content.placeholder_tag.html(content.placeholder_tag.html() + content.current_iterator.next());
				}
			});
		},
		replace: function(data, content, finish_callback) {
			return animate_content(data, content, finish_callback, {
				prepare: function() {
					// placeholder is necessary
					if (!content.placeholder || content.placeholder == '') content.placeholder = '<span>';
					create_placeholder(content, data);
				},
				render: function() {
					content.placeholder_tag.html(content.current_iterator.next());
				}
			});
		}
	}

	var render_strategies = {
		'text-by-char': function(items) {
			return new char_iterator(items.toString());
		},
		'text-by-line': function(items) {
			return new line_iterator(items.toString());
		},
		'text-one-shot': function(items) {
			return new one_shot_iterator(items.toString());
		},
		iterator: function(items) {
			return items.iterator();
		},
		'array-items': function(items) {
			return new array_iterator(items);
		}
	}

	function clean(data) {
		$.each(data.content, function(i, val) {
			val.current_iterator = null;
			val.placeholder_tag = null;
		});
		data.current_content = 0;
		if (data.cursor) {
			data.target.children().not(data.cursor.placeholder_tag).remove();
		} else {
			data.target.children().remove();
		}
	}

	function reset_cursor(data) {
		if (data.cursor) {
			data.cursor.current_iterator = null;
			if (data.cursor.placeholder_tag) {
				data.cursor.placeholder_tag.children().remove();
				data.cursor.placeholder_tag.text('');
			}
		}
	}

	function set_defaults(config) {
		config = $.extend({}, $.fn[plugin_name].defaults.general, config);
		content = [];
		$.each(config.content, function(i, val) {
			content.push($.extend({}, $.fn[plugin_name].defaults.content, val));
		});
		config.content = content;
		if (typeof (config.cursor) != 'undefined') {
			config.cursor = $.extend({}, $.fn[plugin_name].defaults.cursor, config.cursor)
		}
		return config;
	}

	function init($this, config) {
		config = set_defaults(config);

		var data = $this.data(plugin_name);

		if ( ! data ) {
			$this.data(plugin_name, {
				target: $this
			});
		}
		data = $this.data(plugin_name);

		data.loop = config.loop;
		data.content = config.content;
		data.current_content = 0;
		data.times = 0;
		data.running = false;
		data.cursor = config.cursor;

		if (typeof(data.cursor) != "undefined") {
			if (typeof(data.cursor.placeholder) == "undefined" || data.cursor.placeholder == '') {
				data.cursor.placeholder = '<span>';
			}
			data.cursor.times = 0;
		}
	}

	var methods = {
		init : function( config ) {
			return this.each(function() {
				init($(this), config);
			});
		},
		play : function (finish_callback) {
			finish_callback = (typeof finish_callback === "undefined") ? function() {} : finish_callback;
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);

				if (data.running) return;

				data.running = true;

				var secuence = function() {
					if (data.running) {
						if (data.current_content < data.content.length) {
							content = data.content[data.current_content];
							animations[content.animation](
								data,
								content,
								function() {
									++data.current_content;
									secuence();
								}
							);
						} else {
							// a loop finished

							if (data.loop == 'infinite' || data.loop < 1) {
								clean(data);
								secuence();
							} else {
								++data.times;
								if (data.times < data.loop) {
									clean(data);
									secuence();
								} else {
									data.running = false;
									finish_callback();
								}
							}
						}
					}
				}
				secuence();

				var cursor = function() {
					if (data.running && data.cursor) {
						animations[data.cursor.animation](
							data,
							data.cursor,
							function() {
								if (data.cursor.loop == 'infinite' || data.cursor.loop < 1) {
									reset_cursor(data);
									cursor();
								} else {
									++data.cursor.times;
									if (data.cursor.times < data.cursor.loop) {
										reset_cursor(data);
										cursor();
									}
								}
							}
						);
					}
				}
				cursor();
			});
		},
		pause : function( ) {
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);

				data.running = false;
			});
		},
		reset : function( ) {
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);

				data.running = false;

				data.times = 0;
				if (typeof(data.cursor) != "undefined") {
					data.cursor.times = 0;
				}
				clean(data);
				reset_cursor(data);
			});
		},
		configure : function( config ) {
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);
				clean(data);
				data.target.children().remove();
				init($this, config);
			});
		}
	};

	$.fn[plugin_name] = function( method ) {

		// Method calling logic
		if ( methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' + method + ' does not exist on jQuery.' + plugin_name);
		}

	};

	$.fn[plugin_name].defaults = {
		general: {
			loop: 1,
			content: []
		},
		content: {
			animation: 'additive',
			delay: 0,
			placeholder: '<span>',
			render_strategy: 'text-one-shot',
			items: ''
		},
		cursor: {
			loop: 'infinite',
			animation: 'replace',
			delay: 500,
			placeholder: '<span>',
			render_strategy: 'array-items',
			items: []
		}
	}

	$.fn[plugin_name].helper = {
		counter: function(config) {
			return {
				iterator: function() {
					var it = {
						config: $.extend({
							start: 1,
							end: 100,
							step: 1,
							mask: '%d'
						}, config),
						has_next: function() {
							return this.index <= this.config.end;
						},
						next: function() {
							var temp = this.index;
							this.index += Math.max(1, Math.min(this.config.step, Math.abs(this.config.end - this.index)));
							return this.config.mask.replace('%d', temp);
						}
					};
					it.index = it.config.start;
					return it;
				}
			}
		}
	}
})( jQuery );