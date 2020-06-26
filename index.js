async function createShader(gl, shader_info) {
    var shader = gl.createShader(shader_info.type);
    var shader_source = await fetch(shader_info.name)
        .then(response => response.text())

    gl.shaderSource(shader, shader_source);
    gl.compileShader(shader);
    var compile_status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compile_status) {
        var error_message = gl.getShaderInfoLog(shader);
        throw "Could not compile shader \"" +
        shader_info.name +
        "\" \n" +
        error_message;
    }
    return shader;
}

/* Creates an OpenGL program object.
   `gl' shall be a WebGL 2 context.
   `shader_list' shall be a list of objects, each of which have a `name'
      and `type' properties. `name' will be used to locate the script tag
      from which to load the shader. `type' shall indicate shader type (i. e.
      gl.FRAGMENT_SHADER, gl.VERTEX_SHADER, etc.)
  `transform_feedback_varyings' shall be a list of varying that need to be
    captured into a transform feedback buffer.*/
async function createGLProgram(gl, shader_list, transform_feedback_varyings) {
    var program = gl.createProgram();
    for (var i = 0; i < shader_list.length; i++) {
        var shader_info = shader_list[i];
        var shader = await createShader(gl, shader_info);
        gl.attachShader(program, shader);
    }

    /* Specify varyings that we want to be captured in the transform
       feedback buffer. */
    if (transform_feedback_varyings != null) {
        gl.transformFeedbackVaryings(
            program,
            transform_feedback_varyings,
            gl.INTERLEAVED_ATTRIBS)
    }

    gl.linkProgram(program);
    var link_status = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!link_status) {
        var error_message = gl.getProgramInfoLog(program);
        throw "Could not link program.\n" + error_message;
    }
    return program;
}


function randomRGData(size_x, size_y) {
    var d = [];
    for (var i = 0; i < size_x * size_y; ++i) {
        d.push(Math.random() * 255.0);
        d.push(Math.random() * 255.0);
    }
    return new Uint8Array(d);
}

function initialParticleData(num_parts, fieldSize, minSpeed, maxSpeed) {
    var data = [];
    for (var i = 0; i < num_parts; ++i) {
        // position
        data.push(fieldSize.x * 0.5);
        data.push(fieldSize.y * 0.5);

        // velocity
        var speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        var angle = Math.random() * 2.0 * Math.PI;

        data.push(Math.cos(angle) * speed);
        data.push(Math.sin(angle) * speed);
    }
    return data;
}


/*
  This is a helper function used by the main initialization function.
  It sets up a vertex array object based on the given buffers and attributes
  they contain.
  If you're familiar with VAOs, following this should be easy.
  */
function setupParticleBufferVAO(gl, buffers, vao) {
    gl.bindVertexArray(vao);
    for (var i = 0; i < buffers.length; i++) {
        var buffer = buffers[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer_object);
        var offset = 0;
        for (var attrib_name in buffer.attribs) {
            if (buffer.attribs.hasOwnProperty(attrib_name)) {
                /* Set up vertex attribute pointers for attributes that are stored in this buffer. */
                var attrib_desc = buffer.attribs[attrib_name];

                gl.enableVertexAttribArray(attrib_desc.location);
                gl.vertexAttribPointer(
                    attrib_desc.location,
                    attrib_desc.num_components,
                    attrib_desc.type,
                    false,
                    buffer.stride,
                    offset);
                /* we're only dealing with types of 4 byte size in this demo, unhardcode if necessary */
                var type_size = 4;

                /* Note that we're cheating a little bit here: if the buffer has some irrelevant data
                   between the attributes that we're interested in, calculating the offset this way
                   would not work. However, in this demo, buffers are laid out in such a way that this code works :) */
                offset += attrib_desc.num_components * type_size;

                if (attrib_desc.hasOwnProperty("divisor")) { /* we'll need this later */
                    gl.vertexAttribDivisor(attrib_desc.location, attrib_desc.divisor);
                }
            }
        }
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

async function init(
    gl,
    num_particles,
    particle_size,
    particle_influence_area,
    min_speed,
    max_speed,
    part_img) {
    /* Do some parameter validation */
    if (min_speed > max_speed) {
        throw "Invalid min-max speed range.";
    }

    /* Create programs for updating and rendering the particle system. */
    var rtt_program = await createGLProgram(
        gl,
        [
            { name: "particle-render-vert.glsl", type: gl.VERTEX_SHADER },
            { name: "particle-influence-frag.glsl", type: gl.FRAGMENT_SHADER },
        ],
        null);
    var update_program = await createGLProgram(
        gl,
        [
            { name: "particle-update-vert.glsl", type: gl.VERTEX_SHADER },
            { name: "passthru-frag-shader.glsl", type: gl.FRAGMENT_SHADER },
        ],
        [
            "v_Position",
            "v_Velocity",
        ]);
    var render_program = await createGLProgram(
        gl,
        [
            { name: "particle-render-vert.glsl", type: gl.VERTEX_SHADER },
            { name: "particle-render-frag.glsl", type: gl.FRAGMENT_SHADER },
        ],
        null);

    /* Capture attribute locations from program objects. */
    var update_attrib_locations = {
        i_Position: {
            location: gl.getAttribLocation(update_program, "i_Position"),
            num_components: 2,
            type: gl.FLOAT
        },
        i_Velocity: {
            location: gl.getAttribLocation(update_program, "i_Velocity"),
            num_components: 2,
            type: gl.FLOAT
        }
    };
    var render_attrib_locations = {
        i_Position: {
            location: gl.getAttribLocation(render_program, "i_Position"),
            num_components: 2,
            type: gl.FLOAT,
            divisor: 1
        },
    };
    var vaos = [
        gl.createVertexArray(),
        gl.createVertexArray(),
        gl.createVertexArray(),
        gl.createVertexArray()
    ];
    var buffers = [
        gl.createBuffer(),
        gl.createBuffer(),
    ];
    var sprite_vert_data =
        new Float32Array([
            1, 1,
            1, 1,

            -1, 1,
            0, 1,

            -1, -1,
            0, 0,

            1, 1,
            1, 1,

            -1, -1,
            0, 0,

            1, -1,
            1, 0]);
    var sprite_attrib_locations = {
        i_Coord: {
            location: gl.getAttribLocation(render_program, "i_Coord"),
            num_components: 2,
            type: gl.FLOAT,
        },
        i_TexCoord: {
            location: gl.getAttribLocation(render_program, "i_TexCoord"),
            num_components: 2,
            type: gl.FLOAT
        }
    };
    var sprite_vert_buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sprite_vert_buf);
    gl.bufferData(gl.ARRAY_BUFFER, sprite_vert_data, gl.STATIC_DRAW);
    var vao_desc = [
        {
            vao: vaos[0],
            buffers: [{
                buffer_object: buffers[0],
                stride: 4 * 4,
                attribs: update_attrib_locations
            }]
        },
        {
            vao: vaos[1],
            buffers: [{
                buffer_object: buffers[1],
                stride: 4 * 4,
                attribs: update_attrib_locations
            }]
        },
        {
            vao: vaos[2],
            buffers: [{
                buffer_object: buffers[0],
                stride: 4 * 4,
                attribs: render_attrib_locations
            },
            {
                buffer_object: sprite_vert_buf,
                stride: 4 * 4,
                attribs: sprite_attrib_locations
            }],
        },
        {
            vao: vaos[3],
            buffers: [{
                buffer_object: buffers[1],
                stride: 4 * 4,
                attribs: render_attrib_locations
            },
            {
                buffer_object: sprite_vert_buf,
                stride: 4 * 4,
                attribs: sprite_attrib_locations
            }],
        },
    ];
    /* Populate buffers with some initial data. */
    var initial_data =
        new Float32Array(initialParticleData(num_particles, {x: 1000.0, y: 1000.0}, min_speed, max_speed));
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
    gl.bufferData(gl.ARRAY_BUFFER, initial_data, gl.STREAM_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[1]);
    gl.bufferData(gl.ARRAY_BUFFER, initial_data, gl.STREAM_DRAW);

    /* Set up VAOs */
    for (var i = 0; i < vao_desc.length; i++) {
        setupParticleBufferVAO(gl, vao_desc[i].buffers, vao_desc[i].vao);
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    /* Create a texture for random values. */
    var rg_noise_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rg_noise_texture);
    gl.texImage2D(gl.TEXTURE_2D,
        0,
        gl.RG8,
        512, 512,
        0,
        gl.RG,
        gl.UNSIGNED_BYTE,
        randomRGData(512, 512));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // /* Set up blending */
    // gl.enable(gl.BLEND);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


    var particle_tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, particle_tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 32, 32, 0, gl.RGBA, gl.UNSIGNED_BYTE, part_img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);


    // Init render texture
    var renderToTexture = createRenderTex(gl);

    return {
        renderToTexture,
        particle_sys_buffers: buffers,
        particle_sys_vaos: vaos,
        read: 0,
        write: 1,
        particle_update_program: update_program,
        particle_render_program: render_program,
        num_particles: num_particles,
        old_timestamp: 0.0,
        rg_noise: rg_noise_texture,
        total_time: 0.0,
        mouse: [0.0, 0.0],
        min_speed: min_speed,
        max_speed: max_speed,
        particle_tex: particle_tex,
        particle_size
    };
}

/* Gets called every frame.
   `gl' shall be a valid WebGL 2 context
   `state' is shall be the state of the particle system
   `timestamp_millis' is the current timestamp in milliseconds
   */
function render(gl, state, timestamp_millis) {
    resize(gl.canvas);

    // First render to texture
    // render to our targetTexture by binding the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.renderToTexture.frameBuffer);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, state.renderToTexture.width, state.renderToTexture.height);

    // Clear the attachment(s).
    gl.clearColor(1, 0, 1, 1);   // clear to blue
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    /* Calculate time delta. */
    var time_delta = 0.0;
    if (state.old_timestamp != 0) {
        time_delta = timestamp_millis - state.old_timestamp;
        if (time_delta > 500.0) {
            /* If delta is too high, pretend nothing happened.
               Probably tab was in background or something. */
            time_delta = 0.0;
        }
    }

    /* Set the previous update timestamp for calculating time delta in the
       next frame. */
    state.old_timestamp = timestamp_millis;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(state.particle_update_program);

    /* Most of the following is trivial setting of uniforms */
    gl.uniform1f(
        gl.getUniformLocation(state.particle_update_program, "u_TimeDelta"),
        time_delta / 1000.0);
    gl.uniform1f(
        gl.getUniformLocation(state.particle_update_program, "u_TotalTime"),
        state.total_time);
    gl.uniform2f(
        gl.getUniformLocation(state.particle_update_program, "u_FieldSize"),
        gl.canvas.width, gl.canvas.height);
    gl.uniform1f(
        gl.getUniformLocation(state.particle_update_program, "u_MinSpeed"),
        state.min_speed);
    gl.uniform1f(
        gl.getUniformLocation(state.particle_update_program, "u_MaxSpeed"),
        state.max_speed);
    state.total_time += time_delta;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.rg_noise);
    gl.uniform1i(
        gl.getUniformLocation(state.particle_update_program, "u_RgNoise"),
        0);

    /* Bind the "read" buffer - it contains the state of the particle system
      "as of now".*/
    gl.bindVertexArray(state.particle_sys_vaos[state.read]);

    /* Bind the "write" buffer as transform feedback - the varyings of the
       update shader will be written here. */
    gl.bindBufferBase(
        gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.particle_sys_buffers[state.write]);

    /* Since we're not actually rendering anything when updating the particle
       state, disable rasterization.*/
    gl.enable(gl.RASTERIZER_DISCARD);

    /* Begin transform feedback! */
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, state.num_particles);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    /* Don't forget to unbind the transform feedback buffer! */
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

    /* Now, we draw the particle system. Note that we're actually
       drawing the data from the "read" buffer, not the "write" buffer
       that we've written the updated data to. */
    gl.bindVertexArray(state.particle_sys_vaos[state.read + 2]);
    gl.useProgram(state.particle_render_program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.particle_tex);
    //gl.bindTexture(gl.TEXTURE_2D, state.renderToTexture.renderTexture);
    //gl.bindTexture(gl.TEXTURE_2D, state.rg_noise);
    gl.uniform1i(
        gl.getUniformLocation(state.particle_render_program, "u_Sprite"),
        0);
    gl.uniform2f(
        gl.getUniformLocation(state.particle_render_program, "u_FieldSize"),
        gl.canvas.width, gl.canvas.height);
    gl.uniform1f(
        gl.getUniformLocation(state.particle_render_program, "u_ParticleSize"),
        state.particle_size * (gl.canvas.width + gl.canvas.height));
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, state.num_particles);

    /* Finally, we swap read and write buffers. The updated state will be
       rendered on the next frame. */
    var tmp = state.read;
    state.read = state.write;
    state.write = tmp;

    /* This just loops this function. */
    window.requestAnimationFrame(function (ts) { render(gl, state, ts); });
}

function resize(canvas) {
    // Lookup the size the browser is displaying the canvas.
    var displayWidth = window.innerWidth;
    var displayHeight = window.innerHeight;

    // Check if the canvas is not the same size.
    if (canvas.width != displayWidth ||
        canvas.height != displayHeight) {

        // Make the canvas the same size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
}

function createRenderTex(gl) {

    // create to render to
    const targetTextureWidth = 256;
    const targetTextureHeight = 256;
    const targetTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);


    // define size and format of level 0
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        targetTextureWidth, targetTextureHeight, border,
        format, type, data);

    // set the filtering so we don't need mips
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


    // Create and bind the framebuffer
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

    return {
        width: targetTextureWidth,
        height: targetTextureHeight,
        frameBuffer: fb,
        renderTexture: targetTexture
    }
}

var particle_tex = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QAAAAAAAD5Q7t/AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QYTCCY1R1556QAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAC4ElEQVRYw8VXa4/aMBAcB0OgB0ff///vVWpV0UAOcBz3w832hr0EyLVSLa0S7mLPePbhdcAbRykl2HsIobx1nTARMIzMVQJlCqEwATgAmMmcSj7rhUjm8y4iYQLwjKDxCoGO7/leIuEKeCXAkTZzZiM762j2ux8jEW+Az2kRwIIWxSA7NzvTZgCSrDtIIt4Ar/lcAVjSjNBcpiaCJwBH2pNz0yCJOOASBV/yueb7O5qpYcN23YpqAcDJC+wy5oXAwO4XBH0AsAGwJZG1/M/GkQT2tJ1sqFcrpVwEpSpQSZSb7Ab+HsAHIbKhMjZOABr+bTFQI7LLjHxBQFLO734l4F8APPK5ohI29iRWO2U0MC07+mcRnlWIIpWmXS0+3xB4C+ArgM/iCiWw5xrm+44xkfjbMiPTHYMEouT9gi5YO/BPVMRSsuM3P51LLCae3LqdumgsC6LLhC3VeATwkU9LSUu9wPeW3zeSxtGV8ZcsEP9X4oYosVC7gKxJ5kEIVNz1hsArCUglYBjB4iCOlGe1SpSpJM9tdxXlnssGdJ7a7VJ8x7Ag6giiB9DkEUMIpZRSXMHIUlq1yrUMOPW5xUCSb2xOkkNJ1y8+Df0OFdyKzJZRXYvPo+T5TqK+kUxQEqMusBrdOQItgAMXX4p/E4MwcN6BoD8AfOf3B6kDuu7FeaAEtJE40Vou7Gv/nhFvo6EbvhG8obWyVvZF6A8BxoH5J3GnR/5/5ypcIvjOHUYNi5E9d3THUVzR++YkurbKy++7prP425+GRmJPAr/43g4E4+s0pAomU5KioQfLgTbWD+wlE8wtploGkG81JBaIcOc5JNq16dCOyLLGuqFWsihJAI4XIlEBzjW9LB6lvKo6BnISRS7S8GZPOEJCY+N8R1fciSL5Gvg99wJ/QFUi/dC9IEmZzkNR/5abUTVwII0R6KXt6kMI/T+5G7pbUrhyNyxTrmWTLqcDt+JXBP7mlvzfxm8amZhMH7WSmQAAAABJRU5ErkJggg==`;


async function main() {

    let particleCount = 100;
    let particleSizeAsFractionOfViewport = 0.01;
    let particleAreaOfInfluence = 0.05;

    var canvas_element = document.getElementById("mainCanvas");

    var webgl_context = canvas_element.getContext("webgl2");
    if (webgl_context != null) {
        document.body.appendChild(canvas_element);
        var part_img = new Image();
        part_img.src = particle_tex;
        part_img.onload = async function () {
            var state =
                await init(
                    webgl_context,
                    particleCount,
                    particleSizeAsFractionOfViewport,
                    particleAreaOfInfluence,
                    50, 200,
                    part_img);
            canvas_element.onmousemove = function (e) {
                // var x = 2.0 * (e.pageX - this.offsetLeft) / this.width - 1.0;
                // var y = -(2.0 * (e.pageY - this.offsetTop) / this.height - 1.0);
                state.mouse = [e.pageX, e.pageY];
            };
            window.requestAnimationFrame(
                function (ts) { render(webgl_context, state, ts); });
        }
    } else {
        document.write("WebGL2 is not supported by your browser");
    }
}
