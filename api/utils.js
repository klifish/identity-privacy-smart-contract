function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function parseBigInt(value, fallback = 0n) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return BigInt(trimmed);
    }
    return BigInt(trimmed);
  }
  throw new Error('Unable to parse value as BigInt');
}

function normalizeBigInt(input) {
  if (typeof input === 'bigint') {
    return input.toString();
  }
  if (Array.isArray(input)) {
    return input.map((item) => normalizeBigInt(item));
  }
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, normalizeBigInt(value)])
    );
  }
  return input;
}

module.exports = {
  asyncHandler,
  parseBigInt,
  normalizeBigInt,
};
