#version 300 es
precision mediump float;

/* Number of seconds (possibly fractional) that has passed since the last
    update step. */
uniform float u_TimeDelta;

/* A texture with just 2 channels (red and green), filled with random values.
    This is needed to assign a random direction to newly born particles. */
uniform sampler2D u_RgNoise;

uniform vec2 u_FieldSize;

/* The min and max values of the (scalar!) speed.*/
uniform float u_MinSpeed;
uniform float u_MaxSpeed;

/* Inputs. These reflect the state of a single particle before the update. */

/* Where the particle is. */
in vec2 i_Position;
/* Which direction it is moving, and how fast. */
in vec2 i_Velocity;

/* Outputs. These mirror the inputs. These values will be captured
    into our transform feedback buffer! */
out vec2 v_Position;
out vec2 v_Velocity;

void main() {
    /* Get the pair of random values. */
    // ivec2 noise_coord = ivec2(gl_VertexID % 512, gl_VertexID / 512);
    // vec2 rand = texelFetch(u_RgNoise, noise_coord, 0).rg;

    float borderArea = 0.10;
    float borderAcceleration = 300.0;

    //Update velocity
    float leftBorderAcceleration = smoothstep(-1.0 * u_FieldSize.x * borderArea, 0.0, -1.0 * i_Position.x) * borderAcceleration;
    float rightBorderAcceleration = -1.0 * smoothstep(u_FieldSize.x * (1.0 - borderArea), u_FieldSize.x, i_Position.x)  * borderAcceleration;
    float bottomBorderAcceleration = smoothstep(-1.0 * u_FieldSize.y * borderArea, 0.0, -1.0 * i_Position.y) * borderAcceleration;
    float topBorderAcceleration = -1.0 * smoothstep(u_FieldSize.y * (1.0 - borderArea), u_FieldSize.y, i_Position.y)  * borderAcceleration;


    v_Velocity = i_Velocity + vec2(leftBorderAcceleration + rightBorderAcceleration, bottomBorderAcceleration + topBorderAcceleration) * u_TimeDelta;

    float l = length(v_Velocity);
    if(l > u_MaxSpeed) {
        //v_Velocity = v_Velocity / l * u_MaxSpeed;
    }


    // Update position
    v_Position = i_Position + v_Velocity * u_TimeDelta;
    //v_Position = clamp(v_Position, vec2(0), u_FieldSize);
    //v_Position = vec2(mod(v_Position.x, u_FieldSize.x), mod(v_Position.y, u_FieldSize.y));
}
