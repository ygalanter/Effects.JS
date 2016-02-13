
if (typeof (Effects) === 'undefined') {
    Effects = {
        EFFECT_INVERT: 0,
        EFFECT_VERTICAL_MIRROR: 1,
        EFFECT_ROTATE_90_DEGREES: 2,
        EFFECT_OUTLINE: 3,
        EFFECT_HORIZONTAL_MIRROR: 4
    };
}

Effects.getEffectHub = function (rocky, canvas_w, canvas_h) {

    var EffectHub = function (rocky, canvas_w, canvas_h) {

        var ROCKY = rocky;
        var CANVAS_W = canvas_w;
        var CANVAS_H = canvas_h;

        var effects = [];



        //***** begin utility functions

        //gets color of pixel at given coordinates
        var getPixel = function (x, y) {
            return ROCKY.framebuffer[y * CANVAS_W + x];
        }

        //sets color of pixel at given coordinates
        var setPixel = function (x, y, color) {
            ROCKY.framebuffer[y * CANVAS_W + x] = color;
        }
        //***** end utility functions



        //*** Begin effect functions

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


        //*** End effect function


        // adds effect of given type and given bounds to internal array
        this.addEffect = function (effect_type, bounds, param) {
            effects.push({effect_type:effect_type, bounds:bounds, param:param});
        }


        // loops thru array of added effects, rendering them
        this.renderEffects = function () {

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


                }

            })
        }
    }

    return new EffectHub(rocky, canvas_w, canvas_h);

}
