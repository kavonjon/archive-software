/// <reference types="react-scripts" />

// Declare module for .md files
declare module '*.md' {
  const content: string;
  export default content;
}
