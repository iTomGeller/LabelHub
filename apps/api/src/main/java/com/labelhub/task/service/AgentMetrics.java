package com.labelhub.task.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AgentMetrics {

    public static final String AGENT_CONFIG_GEN = "config-gen";
    public static final String AGENT_SCHEMA_RISK = "schema-risk";
    public static final String AGENT_DATASET_PROFILE = "dataset-profile";
    public static final String AGENT_PUBLISH_CHECK = "publish-check";
    public static final String AGENT_PRECHECK = "precheck";

    public static final List<String> ALL_AGENTS = List.of(
            AGENT_CONFIG_GEN, AGENT_SCHEMA_RISK, AGENT_DATASET_PROFILE,
            AGENT_PUBLISH_CHECK, AGENT_PRECHECK
    );

    private final MeterRegistry registry;

    private final ConcurrentHashMap<String, AtomicLong> agentCallCounts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> agentSuccessCounts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> agentErrorCounts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> agentTotalLatencyNs = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> agentLastCallTime = new ConcurrentHashMap<>();

    private final AtomicInteger tasksDraft = new AtomicInteger(0);
    private final AtomicInteger tasksPublishing = new AtomicInteger(0);
    private final AtomicInteger tasksPaused = new AtomicInteger(0);
    private final AtomicInteger tasksEnded = new AtomicInteger(0);
    private final AtomicLong publishTotal = new AtomicLong(0);

    public AgentMetrics(MeterRegistry registry) {
        this.registry = registry;

        for (String agent : ALL_AGENTS) {
            agentCallCounts.put(agent, new AtomicLong(0));
            agentSuccessCounts.put(agent, new AtomicLong(0));
            agentErrorCounts.put(agent, new AtomicLong(0));
            agentTotalLatencyNs.put(agent, new AtomicLong(0));
            agentLastCallTime.put(agent, new AtomicLong(0));
        }

        registry.gauge("task.lifecycle", List.of(io.micrometer.core.instrument.Tag.of("status", "draft")), tasksDraft);
        registry.gauge("task.lifecycle", List.of(io.micrometer.core.instrument.Tag.of("status", "publishing")), tasksPublishing);
        registry.gauge("task.lifecycle", List.of(io.micrometer.core.instrument.Tag.of("status", "paused")), tasksPaused);
        registry.gauge("task.lifecycle", List.of(io.micrometer.core.instrument.Tag.of("status", "ended")), tasksEnded);
    }

    public void recordAgentCall(String agent, String outcome, long durationNs) {
        Counter.builder("agent.invocations")
                .tag("agent", agent)
                .tag("outcome", outcome)
                .register(registry)
                .increment();

        Timer.builder("agent.latency")
                .tag("agent", agent)
                .register(registry)
                .record(Duration.ofNanos(durationNs));

        agentCallCounts.computeIfAbsent(agent, k -> new AtomicLong(0)).incrementAndGet();
        agentTotalLatencyNs.computeIfAbsent(agent, k -> new AtomicLong(0)).addAndGet(durationNs);
        agentLastCallTime.computeIfAbsent(agent, k -> new AtomicLong(0)).set(System.currentTimeMillis());

        if ("success".equals(outcome)) {
            agentSuccessCounts.computeIfAbsent(agent, k -> new AtomicLong(0)).incrementAndGet();
        } else if ("error".equals(outcome)) {
            agentErrorCounts.computeIfAbsent(agent, k -> new AtomicLong(0)).incrementAndGet();
        }
    }

    public void recordConfidence(String agent, double score) {
        DistributionSummary.builder("agent.confidence")
                .tag("agent", agent)
                .register(registry)
                .record(score);
    }

    public void recordAgentChain(String fromAgent, String toAgent) {
        Counter.builder("agent.chain")
                .tag("from", fromAgent)
                .tag("to", toAgent)
                .register(registry)
                .increment();
    }

    public void recordCascadeFailure(String agent) {
        Counter.builder("agent.cascade.failure")
                .tag("agent", agent)
                .register(registry)
                .increment();
    }

    public void recordPipelineStage(String stage, long durationMs) {
        Timer.builder("task.pipeline.duration")
                .tag("stage", stage)
                .register(registry)
                .record(Duration.ofMillis(durationMs));
    }

    public void recordTaskPublish() {
        publishTotal.incrementAndGet();
        Counter.builder("task.publish")
                .register(registry)
                .increment();
    }

    public void recordTaskStatusChange(String toStatus) {
        switch (toStatus) {
            case "draft" -> tasksDraft.incrementAndGet();
            case "publishing" -> tasksPublishing.incrementAndGet();
            case "paused" -> tasksPaused.incrementAndGet();
            case "ended" -> tasksEnded.incrementAndGet();
        }
    }

    public Map<String, AgentStat> getOverview() {
        var overview = new ConcurrentHashMap<String, AgentStat>();
        for (String agent : ALL_AGENTS) {
            long total = agentCallCounts.getOrDefault(agent, new AtomicLong(0)).get();
            long success = agentSuccessCounts.getOrDefault(agent, new AtomicLong(0)).get();
            long totalNs = agentTotalLatencyNs.getOrDefault(agent, new AtomicLong(0)).get();
            long lastCall = agentLastCallTime.getOrDefault(agent, new AtomicLong(0)).get();
            double successRate = total > 0 ? (double) success / total * 100.0 : 0.0;
            double avgLatencyMs = total > 0 ? (double) totalNs / total / 1_000_000.0 : 0.0;
            overview.put(agent, new AgentStat(total, successRate, avgLatencyMs, lastCall));
        }
        return overview;
    }

    public record AgentStat(long totalCalls, double successRate, double avgLatencyMs, long lastCallTimestamp) {}
}
