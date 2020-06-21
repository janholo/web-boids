#version 300 es
precision mediump float;

// Particle sprite texture.
uniform sampler2D u_Sprite;

in float v_Age;
in float v_Life;
in vec2 v_TexCoord;

out vec4 o_FragColor;

void main() {
  float t =  v_Age/v_Life;
  vec4 color = vec4(vec3(1.0, 0.8, 0.3), 1.0-(v_Age/v_Life));
  o_FragColor = color * texture(u_Sprite, v_TexCoord);
}
