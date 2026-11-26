import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { taskService } from '../../src/services/taskService';
import { MonthlyGoal } from '../../src/types';
import { Colors, Shadows } from '../../src/constants/theme';
import { Target, TrendingUp, Award } from 'lucide-react-native';

export default function GoalsScreen() {
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGoals = async () => {
    setLoading(true);
    const data = await taskService.getMonthlyGoals();
    setGoals(data.goals);
    setLoading(false);
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>Strategic Objectives</Text>
          <Text style={styles.headerTitle}>Monthly Goals</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Executive Overview Banner */}
          <View style={[styles.banner, Shadows.sm]}>
            <View style={styles.bannerIconBox}>
              <Award size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Q2 Strategic Milestones</Text>
              <Text style={styles.bannerText}>
                3 key business targets active for this month. 82% overall trajectory.
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={Colors.primary}
              style={{ marginVertical: 40 }}
            />
          ) : (
            goals.map((goal) => {
              const percent = Math.min(
                100,
                Math.max(0, goal.progressPercent ?? Math.round((goal.currentCount / (goal.targetCount || 100)) * 100))
              );

              return (
                <View key={goal.id} style={[styles.goalCard, Shadows.sm]}>
                  <View style={styles.goalTopRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {goal.category.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.percentBadge}>
                      <TrendingUp size={12} color={percent >= 100 ? Colors.success : '#2563EB'} />
                      <Text style={[styles.percentText, percent >= 100 && { color: Colors.success }]}>{percent}%</Text>
                    </View>
                  </View>

                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  {goal.description ? (
                    <Text style={styles.goalDesc}>{goal.description}</Text>
                  ) : null}

                  {(goal.targetMetric || goal.currentMetric) ? (
                    <View style={styles.goalMetricsContainer}>
                      {goal.targetMetric ? (
                        <View style={styles.goalMetricRow}>
                          <Text style={styles.goalMetricHeading}>TARGET: </Text>
                          <Text style={styles.goalMetricContent}>{goal.targetMetric}</Text>
                        </View>
                      ) : null}
                      {goal.currentMetric ? (
                        <View style={[styles.goalMetricRow, goal.targetMetric && { marginTop: 4 }]}>
                          <Text style={styles.goalMetricHeading}>CURRENT: </Text>
                          <Text style={styles.goalMetricContent}>{goal.currentMetric}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Progress bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(percent, 4)}%`,
                            backgroundColor:
                              percent >= 100 ? Colors.success : '#2563EB',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>
                      {percent}% completed
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.navy,
  },
  scrollList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  banner: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.navy,
  },
  bannerText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  goalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  goalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.navyLight,
  },
  percentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 4,
  },
  goalDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 14,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3EFEA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  goalMetricsContainer: {
    backgroundColor: '#FAF9F6',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  goalMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  goalMetricHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  goalMetricContent: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
  },
});
