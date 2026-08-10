import { StatusBar, StyleSheet, Text, View } from 'react-native';

function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.eyebrow}>PRIVATE TAILNET CONTROL</Text>
      <Text style={styles.title}>DeviceBridge</Text>
      <Text style={styles.body}>Native Android client bootstrap ready.</Text>
      <Text style={styles.caption}>Pairing and secure storage are next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#08111f' },
  eyebrow: { color: '#8de1c0', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#e8eef8', fontSize: 42, fontWeight: '800', marginTop: 8 },
  body: { color: '#c2d0e0', fontSize: 18, marginTop: 24 },
  caption: { color: '#8ea4bc', fontSize: 15, marginTop: 8 },
});

export default App;
