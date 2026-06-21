import { useEffect, useRef, memo } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Notifications from "expo-notifications";
import { setupNotificationChannel, restoreLocalNotifications } from "./src/utils/localNotifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ErrorBoundary from "./src/components/ErrorBoundary";

// Show notifications as alerts even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "./src/auth/AuthContext";
import { useAuth } from "./src/auth/useAuth";
import { ThemeProvider, useTheme } from "./src/ThemeContext";
import { TourProvider } from "./src/tour/TourContext";
import TourOverlay from "./src/tour/TourOverlay";
import { navigationRef } from "./src/tour/navigationRef";

import StartScreen from "./src/screens/StartScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import OnboardingScreen from "./src/screens/auth/OnboardingScreen";
import OnboardingGuideScreen from "./src/screens/auth/OnboardingGuideScreen";

import DashboardScreen from "./src/screens/tabs/DashboardScreen";
import FitnessScreen from "./src/screens/tabs/FitnessScreen";
import TrackingScreen from "./src/screens/tabs/TrackingScreen";
import FoodScreen from "./src/screens/tabs/FoodScreen";
import ChatScreen from "./src/screens/tabs/ChatScreen";
import SettingsScreen from "./src/screens/tabs/SettingsScreen";
import SocialScreen from "./src/screens/social/SocialScreen";
import ConversationScreen from "./src/screens/social/ConversationScreen";
import FriendProfileScreen from "./src/screens/social/FriendProfileScreen";

import LogFoodScreen from "./src/screens/food/LogFoodScreen";
import FoodCameraScreen from "./src/screens/food/FoodCameraScreen";
import FindRecipesScreen from "./src/screens/food/FindRecipesScreen";
import FoodTrackingScreen from "./src/screens/food/FoodTrackingScreen";

import WorkoutScreen from "./src/screens/fitness/WorkoutScreen";
import WorkoutPlansScreen from "./src/screens/fitness/WorkoutPlansScreen";
import WorkoutPlanDetailScreen from "./src/screens/fitness/WorkoutPlanDetailScreen";
import WorkoutHistoryScreen from "./src/screens/fitness/WorkoutHistoryScreen";
import ExerciseEncyclopediaScreen from "./src/screens/fitness/ExerciseEncyclopediaScreen";
import CustomPlanBuilderScreen from "./src/screens/fitness/CustomPlanBuilderScreen";
import WeightTrackingScreen from "./src/screens/fitness/WeightTrackingScreen";
import BodyTrackingScreen from "./src/screens/fitness/BodyTrackingScreen";
import BodyMeasurementsScreen from "./src/screens/fitness/BodyMeasurementsScreen";
import WorkoutTrackingScreen from "./src/screens/fitness/WorkoutTrackingScreen";
import ActivityTrackingScreen from "./src/screens/fitness/ActivityTrackingScreen";

import ProfileScreen from "./src/screens/profile/ProfileScreen";
import NotificationsScreen from "./src/screens/profile/NotificationsScreen";

// ── Global JS error handler ───────────────────────────────────────────────────
// Catches unhandled JS exceptions outside React's render cycle (async functions,
// event handlers, module-level code). ErrorBoundary above catches render errors.
// Only installed in production — dev mode keeps the red error overlay.
if (!__DEV__) {
  const _prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error(
      `[GlobalError] ${isFatal ? "FATAL" : "non-fatal"}: ${error?.message}\n${error?.stack}`,
    );
    _prevHandler?.(error, isFatal);
  });
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const DashStack = createNativeStackNavigator();
const FitnessStack = createNativeStackNavigator();
const TrackStack = createNativeStackNavigator();
const FoodStack = createNativeStackNavigator();
const SocialStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();

function DashboardStackNav() {
  return (
    <DashStack.Navigator screenOptions={{ headerShown: false }}>
      <DashStack.Screen name="DashboardMain" component={DashboardScreen} />
      <DashStack.Screen name="Profile" component={ProfileScreen} />
      <DashStack.Screen name="Settings" component={SettingsScreen} />
      <DashStack.Screen name="Notifications" component={NotificationsScreen} />
    </DashStack.Navigator>
  );
}

function FitnessStackNav() {
  return (
    <FitnessStack.Navigator screenOptions={{ headerShown: false }}>
      <FitnessStack.Screen name="FitnessMain" component={FitnessScreen} />
      <FitnessStack.Screen name="Workout" component={WorkoutScreen} />
      <FitnessStack.Screen name="WorkoutPlans" component={WorkoutPlansScreen} />
      <FitnessStack.Screen name="WorkoutPlanDetail" component={WorkoutPlanDetailScreen} />
      <FitnessStack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <FitnessStack.Screen name="ExerciseEncyclopedia" component={ExerciseEncyclopediaScreen} />
      <FitnessStack.Screen name="CustomPlanBuilder" component={CustomPlanBuilderScreen} />
      <FitnessStack.Screen name="WeightTracking" component={WeightTrackingScreen} />
      <FitnessStack.Screen name="ActivityTracking" component={ActivityTrackingScreen} />
      <FitnessStack.Screen name="Profile" component={ProfileScreen} />
      <FitnessStack.Screen name="Settings" component={SettingsScreen} />
      <FitnessStack.Screen name="Notifications" component={NotificationsScreen} />
    </FitnessStack.Navigator>
  );
}

function TrackingStackNav() {
  return (
    <TrackStack.Navigator screenOptions={{ headerShown: false }}>
      <TrackStack.Screen name="TrackingMain" component={TrackingScreen} />
      <TrackStack.Screen name="BodyTracking" component={BodyTrackingScreen} />
      <TrackStack.Screen name="BodyMeasurements" component={BodyMeasurementsScreen} />
      <TrackStack.Screen name="FoodTracking" component={FoodTrackingScreen} />
      <TrackStack.Screen name="WorkoutTracking" component={WorkoutTrackingScreen} />
      <TrackStack.Screen name="ActivityTracking" component={ActivityTrackingScreen} />
      <TrackStack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <TrackStack.Screen name="Profile" component={ProfileScreen} />
      <TrackStack.Screen name="Settings" component={SettingsScreen} />
      <TrackStack.Screen name="Notifications" component={NotificationsScreen} />
    </TrackStack.Navigator>
  );
}

function FoodStackNav() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodMain" component={FoodScreen} />
      <FoodStack.Screen name="LogFood" component={LogFoodScreen} />
      <FoodStack.Screen name="FoodCamera" component={FoodCameraScreen} options={{ animation: "fade" }} />
      <FoodStack.Screen name="FindRecipes" component={FindRecipesScreen} />
      <FoodStack.Screen name="Profile" component={ProfileScreen} />
      <FoodStack.Screen name="Settings" component={SettingsScreen} />
      <FoodStack.Screen name="Notifications" component={NotificationsScreen} />
    </FoodStack.Navigator>
  );
}

function SocialStackNav() {
  return (
    <SocialStack.Navigator screenOptions={{ headerShown: false }}>
      <SocialStack.Screen name="SocialMain"    component={SocialScreen} />
      <SocialStack.Screen name="Conversation"  component={ConversationScreen} />
      <SocialStack.Screen name="FriendProfile" component={FriendProfileScreen} />
    </SocialStack.Navigator>
  );
}

function ChatStackNav() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatMain" component={ChatScreen} />
    </ChatStack.Navigator>
  );
}

// ─── Tab metadata ─────────────────────────────────────────────────────────────
const TAB_META = {
  Dashboard: { label: "Home",    active: "home",                inactive: "home-outline"               },
  Fitness:   { label: "Fitness", active: "barbell",             inactive: "barbell-outline"            },
  Tracking:  { label: "Track",   active: "stats-chart",         inactive: "stats-chart-outline"        },
  Food:      { label: "Food",    active: "nutrition",           inactive: "nutrition-outline"          },
  Social:    { label: "Social",  active: "people",              inactive: "people-outline"             },
  Chat:      { label: "Chat",    active: "chatbubble-ellipses", inactive: "chatbubble-ellipses-outline"},
};

// ─── Single animated tab button ───────────────────────────────────────────────
const TabItem = memo(function TabItem({ focused, routeName, colors, onPress }) {
  const meta = TAB_META[routeName] ?? { label: routeName, active: "ellipse", inactive: "ellipse-outline" };

  // Pill: springs in (scale + opacity) when focused, fades out when not
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pillScale   = useRef(new Animated.Value(focused ? 1 : 0.5)).current;
  // Icon: bounces up slightly on activation
  const iconScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      // Bounce the icon up, then spring the pill in
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 1.25, useNativeDriver: true, damping: 6, stiffness: 320 }),
        Animated.spring(iconScale, { toValue: 1,    useNativeDriver: true, damping: 8, stiffness: 200 }),
      ]).start();
      Animated.parallel([
        Animated.spring(pillOpacity, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
        Animated.spring(pillScale,   { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 220 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(pillOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.spring(pillScale,   { toValue: 0.5, useNativeDriver: true, damping: 14, stiffness: 200 }),
      ]).start();
    }
  }, [focused]);

  const iconColor = focused ? colors.primary : colors.textLight;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={tabStyles.item}
      activeOpacity={0.7}
    >
      {/* Animated pill backdrop */}
      <View style={tabStyles.iconWrap}>
        <Animated.View
          style={[
            tabStyles.pill,
            { backgroundColor: colors.primary + "1a", opacity: pillOpacity, transform: [{ scale: pillScale }] },
          ]}
        />
        {/* Icon */}
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <Ionicons
            name={focused ? meta.active : meta.inactive}
            size={22}
            color={iconColor}
          />
        </Animated.View>
      </View>
      {/* Label */}
      <Text style={[tabStyles.label, { color: iconColor, fontWeight: focused ? "700" : "500" }]}>
        {meta.label}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Custom tab bar container ─────────────────────────────────────────────────
function CustomTabBar({ state, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      tabStyles.bar,
      {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
      },
    ]}>
      {state.routes
        .filter(route => route.name !== "Chat")
        .map(route => {
          const originalIndex = state.routes.indexOf(route);
          const isFocused = state.index === originalIndex;
          return (
            <TabItem
              key={route.key}
              focused={isFocused}
              routeName={route.name}
              colors={colors}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate({ name: route.name, merge: true });
                }
              }}
            />
          );
        })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
    // Upward shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
  },
  item: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 2,
  },
  iconWrap: {
    width: 48,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    width: 48,
    height: 34,
    borderRadius: 17,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});

// ─── Main tabs ─────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      id="MainTabs"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardStackNav} />
      <Tab.Screen name="Fitness"   component={FitnessStackNav} />
      <Tab.Screen name="Tracking"  component={TrackingStackNav} />
      <Tab.Screen name="Food"      component={FoodStackNav} />
      <Tab.Screen name="Social"    component={SocialStackNav} />
      <Tab.Screen name="Chat"      component={ChatStackNav} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { auth, bootstrapped } = useAuth();
  const { colors, isDark } = useTheme();

  if (!bootstrapped) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isAuthed = !!(auth && auth.token);
  const onboardingDone = isAuthed && auth.onboardingComplete === true;

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthed ? (
        <>
          <Stack.Screen name="Start" component={StartScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : !onboardingDone ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="OnboardingGuide" component={OnboardingGuideScreen} />
        </>
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
    </>
  );
}

function AppInner() {
  const { auth } = useAuth();
  const userId = auth?.userId ?? null;

  // Set up Android channel + restore any previously-scheduled notifications
  useEffect(() => {
    setupNotificationChannel();
    AsyncStorage.getItem("sff_settings_v1")
      .then((raw) => {
        const notifications = raw
          ? (JSON.parse(raw)?.notifications ?? { workouts: true, food: true, streak: true })
          : { workouts: true, food: true, streak: true };
        restoreLocalNotifications(notifications);
      })
      .catch(() => {});
  }, []);

  return (
    <TourProvider userId={userId}>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
        <TourOverlay />
      </NavigationContainer>
    </TourProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
