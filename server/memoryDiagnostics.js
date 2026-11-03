/**
 * server/memoryDiagnostics.js
 * 
 * Lightweight Production Memory & Job Diagnostics for BUSINZ CRM
 * 
 * Tracks:
 * - Process memory: RSS, Heap Total, Heap Used, External Memory, Array Buffers
 * - Background job metrics: durations, statuses, overlapping execution attempts
 * - Strict Privacy: Zero PII, zero tokens, zero credentials logged
 */

const jobMetrics = {
  inactivityEngine: {
    totalRuns: 0,
    totalSkippedOverlap: 0,
    lastStartedAt: null,
    lastDurationMs: 0,
    lastCompletedAt: null,
    status: 'idle'
  },
  backupEngine: {
    totalRuns: 0,
    totalSkippedOverlap: 0,
    lastStartedAt: null,
    lastDurationMs: 0,
    lastCompletedAt: null,
    status: 'idle'
  }
};

/**
 * Record start of a background job
 */
export function recordJobStart(jobName) {
  if (!jobMetrics[jobName]) {
    jobMetrics[jobName] = {
      totalRuns: 0,
      totalSkippedOverlap: 0,
      lastStartedAt: null,
      lastDurationMs: 0,
      lastCompletedAt: null,
      status: 'idle'
    };
  }
  jobMetrics[jobName].totalRuns++;
  jobMetrics[jobName].lastStartedAt = new Date().toISOString();
  jobMetrics[jobName].status = 'running';
  return Date.now();
}

/**
 * Record completion of a background job
 */
export function recordJobEnd(jobName, startTime) {
  if (jobMetrics[jobName]) {
    jobMetrics[jobName].lastDurationMs = Date.now() - startTime;
    jobMetrics[jobName].lastCompletedAt = new Date().toISOString();
    jobMetrics[jobName].status = 'idle';
  }
}

/**
 * Record skipped overlapping execution attempt
 */
export function recordJobOverlap(jobName) {
  if (jobMetrics[jobName]) {
    jobMetrics[jobName].totalSkippedOverlap++;
  }
}

/**
 * Get unified snapshot of process memory and active background jobs
 */
export function getSystemDiagnostics() {
  const mem = process.memoryUsage();
  return {
    memory: {
      rssMb: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
      externalMb: Math.round((mem.external / (1024 * 1024)) * 100) / 100,
      arrayBuffersMb: Math.round(((mem.arrayBuffers || 0) / (1024 * 1024)) * 100) / 100
    },
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version
    },
    backgroundJobs: {
      ...jobMetrics,
      activeJobCount: Object.values(jobMetrics).filter(j => j.status === 'running').length
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Log structured memory diagnostics without credentials or sensitive data
 */
export function logMemoryDiagnostic(tag = 'DIAGNOSTIC') {
  const diag = getSystemDiagnostics();
  console.log(
    `[Memory ${tag}] RSS: ${diag.memory.rssMb}MB | ` +
    `Heap: ${diag.memory.heapUsedMb}MB / ${diag.memory.heapTotalMb}MB | ` +
    `Ext: ${diag.memory.externalMb}MB | ArrBuf: ${diag.memory.arrayBuffersMb}MB | ` +
    `ActiveJobs: ${diag.backgroundJobs.activeJobCount}`
  );
  return diag;
}
