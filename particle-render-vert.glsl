#version 300 es
precision mediump float;

uniform vec2 u_FieldSize;

uniform float u_ParticleSize;

// These attributes stay the same for all vertices in an instance.
in vec2 i_Position;
in vec2 i_Velocity;

// These attributes change for each of the instance's vertices.
in vec2 i_Coord;
in vec2 i_TexCoord;

out vec2 v_TexCoord;
out vec2 v_Velocity;

void main() {
  vec2 pos = i_Position + i_Coord * u_ParticleSize;

  vec2 normalised = pos / u_FieldSize;
  vec2 norm2 = normalised * 2.0 - 1.0; 

  v_TexCoord = i_TexCoord;
  v_Velocity = i_Velocity;
  gl_Position = vec4(norm2.x, norm2.y, 0.0, 1.0);
}