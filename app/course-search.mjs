export function normalizeCourseCode(value) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function courseSubject(code) {
  return code.trim().split(/\s+/)[0].toLowerCase();
}

export function matchesCourseSearch(course, rawQuery, knownSubjects) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const normalizedQuery = normalizeCourseCode(query);
  const normalizedCode = normalizeCourseCode(course.code);
  const isSubjectQuery = /^[a-z]{2,4}$/i.test(query) && knownSubjects.has(query);
  const isFullCodeQuery = /^[a-z]{2,4}\s*\d{1,3}[a-z]?(?:\/[a-z])?$/i.test(query);

  if (isSubjectQuery) return courseSubject(course.code) === query;
  if (isFullCodeQuery) return normalizedCode === normalizedQuery;

  return [course.code, course.name, course.description, course.topic_tags_inferred.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
