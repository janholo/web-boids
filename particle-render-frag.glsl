#version 300 es
precision mediump float;

// Particle sprite texture.
uniform sampler2D u_Sprite;

in vec2 v_TexCoord;
in vec2 v_Velocity;

out vec4 o_FragColor;

void main() {
  vec4 color = vec4(vec3(1.0, 0.8, 0.3), 1.0);
  o_FragColor = texture(u_Sprite, v_TexCoord) * color;
}
