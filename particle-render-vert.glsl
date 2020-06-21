#version 300 es
precision mediump float;

// These attributes stay the same for all vertices in an instance.
in vec2 i_Position;
in float i_Age;
in float i_Life;
in vec2 i_Velocity;

// These attributes change for each of the instance's vertices.
in vec2 i_Coord;
in vec2 i_TexCoord;

out float v_Age;
out float v_Life;
out vec2 v_TexCoord;

void main() {
  float scale = 0.75; /* the quad is 1.0x1.0, we scale it appropriately */
  vec2 vert_coord = i_Position +
					(scale*(1.0-i_Age / i_Life) + 0.25) * 0.1 * i_Coord +
					i_Velocity * 0.0;
  v_Age = i_Age;
  v_Life = i_Life;
  v_TexCoord = i_TexCoord;
  gl_Position = vec4(vert_coord, 0.0, 1.0);
}