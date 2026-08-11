const React = require('react');

const element = (name) => (props) => React.createElement(name, props, props.children);

module.exports = {
  Animated: { View: element('Animated.View'), Value: function Value() { this.interpolate = () => 0; }, timing: () => ({ start: () => {} }), loop: () => ({ start: () => {}, stop: () => {} }), sequence: () => ({}) },
  Easing: { out: () => () => {}, cubic: () => 0 },
  StatusBar: element('StatusBar'),
  Pressable: element('Pressable'),
  Text: element('Text'),
  TextInput: element('TextInput'),
  View: element('View'),
  ScrollView: element('ScrollView'),
  StyleSheet: { create: (styles) => styles },
};
