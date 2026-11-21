import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

/// Fixture-backed shell. No network client, no analytics, no crash reporting,
/// no push SDK. A fixture-backed shell is not proof of a working product, a
/// working integration or any safety capability.
void main() {
  runApp(const ProviderScope(child: PemoApp()));
}
