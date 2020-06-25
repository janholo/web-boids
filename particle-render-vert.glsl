#version 300 es
precision mediump float;

uniform vec2 u_FieldSize;

// These attributes stay the same for all vertices in an instance.
in vec2 i_Position;

// These attributes change for each of the instance's vertices.
in vec2 i_Coord;
in vec2 i_TexCoord;

out vec2 v_TexCoord;

void main() {
  float rectSize = 5.0;

  vec2 normalised = vec2((i_Position.x + i_Coord.x * rectSize) / u_FieldSize.x, (i_Position.y + i_Coord.y * rectSize) / u_FieldSize.y);
  vec2 norm2 = normalised * 2.0 - 1.0; 

  v_TexCoord = i_TexCoord;
  gl_Position = vec4(norm2.x, norm2.y, 0.0, 1.0);
}