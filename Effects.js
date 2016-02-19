﻿
if (typeof (Effects) === 'undefined') {
    Effects = {
        EFFECT_INVERT: 0,
        EFFECT_VERTICAL_MIRROR: 1,
        EFFECT_ROTATE_90_DEGREES: 2,
        EFFECT_OUTLINE: 3,
        EFFECT_HORIZONTAL_MIRROR: 4,
        EFFECT_MASK: 5,
        EFFECT_BLUR: 6
    };
}

Effects.getEffectHub = function (rocky, canvas_w, canvas_h) {

    var EffectHub = function (rocky, canvas_w, canvas_h) {

        var ROCKY = rocky;
        var CANVAS_W = canvas_w;
        var CANVAS_H = canvas_h;

        var effects = [];



        //***** begin utility functions

        //based on GColor.js converts RGB color to GColor
        function GColorFromRGB(r,g,b) {
            var a = 192;
            var r = (r >> 6) << 4;
            var g = (g >> 6) << 2;
            var b = (b >> 6) << 0;
            return a + r + g + b;
        }

        //based on GColor.js converts GColor to RGB color
        function GColorToRGB(color) {
            
            return {
                r : (color & 48) >> 4,
                g : (color & 12) >> 2,
                b : (color & 3) >> 0
            }
        }


        // gets color of pixel at given coordinates
        // either from passed bitmap data or from actual framebuffer
        var getPixel = function (x, y, bitmap_info) {
            if (bitmap_info) {
                // **** since we obtained RGBA data from Canvas .getData method - need to convert it to GColor
                var offset = (y * bitmap_info.bitmap_w + x) * 4;
                return GColorFromRGB(bitmap_info.bitmap_data[offset], bitmap_info.bitmap_data[offset + 1], bitmap_info.bitmap_data[offset + 2]);
                // **** }
            } else {
                return ROCKY.framebuffer[y * CANVAS_W + x];
            }
        }

        //sets color of pixel at given coordinates
        var setPixel = function (x, y, color) {
            ROCKY.framebuffer[y * CANVAS_W + x] = color;
        }


        // substitute for gbitmap_get_data_row_info to get row of pixels at curret Y row position
        var framebuffer_get_data_row_info = function (y) {
            return {
                data: ROCKY.framebuffer.subarray(144 * y, 144 * y + 144),
                min_x: 0,
                max_x: 144
            }
        }

        // memcpy implementation for JS arrays
        function memcpy(dst, dstOffset, src, srcOffset, length) {

            dst.subarray(dstOffset).set(src.subarray(srcOffset, srcOffset + length));
            
        }


        //***** end utility functions

        


        //*** Begin effect functions

        // helper function for blur effect
        var blur_ = function(row, x_start, x_end, dest, radius){
            var total = new Array(3);
            var nb_points = 0;

            for (var x = x_start; x < x_end; ++x) {
                total[0] = total[1] = total[2] = 0;
                nb_points = 0;
                for (var ky = row - radius; ky <= row + radius; ++ky){
                    if (ky >= 0 && ky < CANVAS_H) {
                        var row_info = framebuffer_get_data_row_info(ky);
                        for (kx = x - radius; kx <= x + radius; ++kx){
                            if(row_info.min_x <= kx && kx <= row_info.max_x)
                            {
                                var color = GColorToRGB(row_info.data[kx]);
                                total[0] += color.r;
                                total[1] += color.g;
                                total[2] += color.b;
                                nb_points++;
                            }
                        }
                    }
                }
                total[0] = (total[0] * 0x55) / nb_points;
                total[1] = (total[1] * 0x55) / nb_points;
                total[2] = (total[2] * 0x55) / nb_points;
                dest[x-x_start] = GColorFromRGB(total[0], total[1], total[2]); 
            }
        }


        //blur effect, second parameter is radious of the blur
        var fn_blur_effect = function (bounds, radius) {

            var offset_x = bounds.x;
            var offset_y = bounds.y;
            var width    = bounds.w;
            var height   = bounds.h;
  
            var buffer = new ArrayBuffer(width * (radius + 1));
            var buffer_array = new Uint8Array(buffer);

            var row_infos = [];
            var circular_index = 0;

            var h=0;
            for(; h<radius+1; h++){
                row_infos[h] = framebuffer_get_data_row_info(offset_y+h);
                row_infos[h].min_x = Math.max(row_infos[h].min_x, offset_x);
                row_infos[h].max_x = Math.min(offset_x + width, row_infos[h].max_x);
                blur_(offset_y+h, row_infos[h].min_x, row_infos[h].max_x, buffer_array.subarray(h*width), radius);
            }

            for (; h < height; h++) {

                memcpy(row_infos[circular_index].data, row_infos[circular_index].min_x,
                    buffer_array, circular_index * width,
                    row_infos[circular_index].max_x - row_infos[circular_index].min_x);

                row_infos[circular_index] = framebuffer_get_data_row_info(offset_y+h);
                row_infos[circular_index].min_x = Math.max(row_infos[circular_index].min_x, offset_x);
                row_infos[circular_index].max_x = Math.min(offset_x + width, row_infos[circular_index].max_x);
                blur_(offset_y + h, row_infos[circular_index].min_x, row_infos[circular_index].max_x, buffer_array.subarray(circular_index * width), radius);
                circular_index = circular_index < radius ? circular_index + 1 : 0;
            }

            h=0;
            for(; h<radius; h++){
                memcpy(row_infos[circular_index].data, row_infos[circular_index].min_x,
                    buffer_array, circular_index * width,
                    row_infos[circular_index].max_x - row_infos[circular_index].min_x);

                circular_index = circular_index < radius ? circular_index + 1 : 0;
            }
  
        }



        //invert effect
        var fn_invert_effect = function (bounds) {
            for (var x = 0; x < bounds.w; x++) {
                for (var y = 0; y < bounds.h; y++) {
                    setPixel(bounds.x + x, bounds.y + y, ~getPixel(bounds.x + x, bounds.y + y) | 11000000);
              }
            }
        }


        //vertical mirror effect
        var fn_vertical_mirror_effect = function (bounds) {
            var temp_pixel;

            for (var x = 0; x < bounds.w; x++) {
                for (var y = 0; y < bounds.h / 2; y++) {
                    temp_pixel = getPixel(bounds.x + x, bounds.y + y);
                    setPixel(bounds.x + x, bounds.y + y, getPixel(bounds.x + x, bounds.y + bounds.h - y));
                    setPixel(bounds.x + x, bounds.y + bounds.h - y, temp_pixel);
                }
            }
        }


        // Rotate 90 degrees
        // based on C version by Ron64
        // Parameter:  true: rotate right/clockwise,  false: rotate left/counter_clockwise
        var fn_rotate_90_degree_effect = function (bounds, right) {
            var temp_pixel;
            var xCn = bounds.x + bounds.w /2;
            var yCn = bounds.y + bounds.h /2;
            var qtr = (bounds.h < qtr ? bounds.h : bounds.w) / 2;
   
            for (var c1 = 0; c1 < qtr; c1++)
              for (var c2 = 1; c2 < qtr; c2++){
                 temp_pixel = getPixel(xCn +c2, yCn +c1);
                 if (right){
                     setPixel(xCn +c2,yCn +c1,  getPixel(xCn +c1, yCn -c2));
                     setPixel(xCn +c1,yCn -c2,  getPixel(xCn -c2, yCn -c1));
                     setPixel(xCn -c2,yCn -c1,  getPixel(xCn -c1, yCn +c2));
                     setPixel(xCn -c1,yCn +c2,  temp_pixel);
                 }
                 else{
                     setPixel(xCn +c2, yCn +c1, getPixel(xCn -c1, yCn +c2));
                     setPixel(xCn -c1, yCn +c2, getPixel(xCn -c2, yCn -c1));
                     setPixel(xCn -c2, yCn -c1, getPixel(xCn +c1, yCn -c2));
                     setPixel(xCn +c1, yCn -c2, temp_pixel);
                 }
            }
        }

        // parameter outline: {offset_x, offset_y, orig_color, offset_color}
        var fn_outline_effect = function (bounds, outline) {
            var temp_pixel, outlinex = [], outliney = [];
     
            //loop through pixels from framebuffer
            for (var y = 0; y < bounds.h; y++)
            for (var x = 0; x < bounds.w; x++) {
                for (var a = 0; a <= outline.offset_x; a++) 
                for (var b = 0; b <= outline.offset_y; b++) {
  
                    temp_pixel = getPixel(x + bounds.x, y + bounds.y);
       
                    if (temp_pixel == outline.orig_color) {
                        outlinex[0] = x + bounds.x - a;
                        outliney[0] = y + bounds.y - b;
                        outlinex[1] = x + bounds.x + a;
                        outliney[1] = y + bounds.y + b;
                        outlinex[2] = x + bounds.x - a;
                        outliney[2] = y + bounds.y + b;
                        outlinex[3] = x + bounds.x + a;
                        outliney[3] = y + bounds.y - b;
         
                        for (var i = 0; i < 4; i++) {
                            if (outlinex[i] >= 0 && outlinex[i] <= CANVAS_W  && outliney[i] >= 0 && outliney[i] <= CANVAS_H) {
                                temp_pixel = getPixel(outlinex[i], outliney[i]);
                                if (temp_pixel != outline.orig_color) {
                                    setPixel(outlinex[i], outliney[i], outline.offset_color);
                                }
                            }
                        }
                    }
                }
            }
        }

        // horizontal mirror effect.
        var fn_horizontal_mirror_effect = function(bounds) {
            var temp_pixel;  
            
            for (var y = 0; y < bounds.h; y++)
            for (var x = 0; x < bounds.w / 2; x++){
                temp_pixel = getPixel(x + bounds.x, y + bounds.y);
                setPixel(x + bounds.x, y + bounds.y, getPixel(bounds.x + bounds.w - x, y + bounds.y));
                setPixel(bounds.x + bounds.w - x, y + bounds.y, temp_pixel);
            }
  
        }

        var fn_mask_effect = function(bounds, mask, ctx) {
            var temp_pixel;  
           
            //drawing background - only if real color is passed
            if (mask.background_color && mask.background_color != GColorClear) {
                graphics_context_set_fill_color(ctx, mask.background_color);
                graphics_fill_rect(ctx, [bounds.x, bounds.y, bounds.w, bounds.h], 0, GCornerNone); 
            }  
  
            //if text mask is used - drawing text
            if (mask.text) {
                graphics_context_set_text_color(ctx, mask.mask_colors[0]); // for text using only 1st color from array of mask colors
                graphics_draw_text(ctx, mask.text, mask.font, [bounds.x, bounds.y, bounds.w, bounds.h], mask.text_overflow, mask.text_align, 0);
            } else if (mask.bitmap_mask) { // othersise - bitmap mask is used - draw bimap
                graphics_draw_bitmap_in_rect(ctx, mask.bitmap_mask, [bounds.x, bounds.y, bounds.w, bounds.h]);
            }
               
  
            //looping throughout layer replacing mask with bg bitmap
            for (var y = 0; y < bounds.h; y++)
                for (var x = 0; x < bounds.w; x++) {
                    temp_pixel = getPixel(x + bounds.x, y + bounds.y);

                    if ( mask.mask_colors.indexOf(temp_pixel) > -1) { // if array of mask colors matches current screen pixel color:
                      setPixel(x + bounds.x, y + bounds.y, getPixel(x, y, mask.bitmap_background_info)); //copying pixel from background bitmap data to screen
                    } 
  
               }
  
        }


        //*** End effect function


        // adds effect of given type and given bounds to internal array
        this.addEffect = function (effect_type, bounds, param) {
            effects.push({effect_type:effect_type, bounds:bounds, param:param});
        }


        // loops thru array of added effects, rendering them
        // ctx: Graphis contexts passed from inside Rocky update proc for those effects that need it
        this.renderEffects = function (ctx) {

            effects.forEach(function (effect) {

                switch (effect.effect_type) {
                    case Effects.EFFECT_INVERT:
                        fn_invert_effect(effect.bounds);
                        break;
                    case Effects.EFFECT_VERTICAL_MIRROR:
                        fn_vertical_mirror_effect(effect.bounds);
                        break;
                    case Effects.EFFECT_ROTATE_90_DEGREES:
                        fn_rotate_90_degree_effect(effect.bounds, effect.param); //param = true or false
                        break;
                    case Effects.EFFECT_OUTLINE:
                        fn_outline_effect(effect.bounds, effect.param); //param = object  {offset_x, offset_y, orig_color, offset_color}
                        break;
                    case Effects.EFFECT_HORIZONTAL_MIRROR:
                        fn_horizontal_mirror_effect(effect.bounds);
                        break;
                    case Effects.EFFECT_MASK:
                        fn_mask_effect(effect.bounds, effect.param, ctx);
                        break;
                    case Effects.EFFECT_BLUR:
                        fn_blur_effect(effect.bounds, effect.param); // param = radius of blur

                }

            })
        }
    }

    return new EffectHub(rocky, canvas_w, canvas_h);

}

// Converts PNG data to raw binary RGBA format
// Based on loadPNGdata function from https://web.archive.org/web/20120604141209/http://www.nihilogic.dk/labs/canvascompress/pngdata.js
// strFileName: path to PNG source
// fnCallback: callback function that returns bitmap_info
// data: optional data to be passed back to callback function
Effects.gbitmap_get_data = function(strFilename, fncCallback, data) {
	// test for canvas and getImageData
	var bCanvas = false;
	var oCanvas = document.createElement("canvas");
	if (oCanvas.getContext) {
		var oCtx = oCanvas.getContext("2d");
		if (oCtx.getImageData) {
			bCanvas = true;
		}
	}
	if (bCanvas) {
		var oImg = new Image();
		oImg.style.position = "absolute";
		oImg.style.left = "-10000px";
		document.body.appendChild(oImg);
		oImg.crossOrigin = "anonymous";
		oImg.onload = function() {
			var iWidth = this.offsetWidth;
			var iHeight = this.offsetHeight;
			oCanvas.width = iWidth;
			oCanvas.height = iHeight;
			oCanvas.style.width = iWidth + "px";
			oCanvas.style.height = iHeight + "px";
			oCtx.drawImage(this,0,0);
			var oData = oCtx.getImageData(0,0,iWidth,iHeight).data;
			if (fncCallback) {
			    fncCallback({ bitmap_data: oData, bitmap_w: iWidth, bitmap_h: iHeight }, data); // returning bitmap_info {bitmap_data, bitmap_w, bitmap_h}, [and optional data]
			}
			document.body.removeChild(oImg);
		}
		oImg.src = strFilename;
		return true;
	} else {
		return false;
	}
}