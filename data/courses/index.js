/**
 * courses/index.js
 * Central registry for all courses
 */

import { beginnerVocabCourse } from './beginner-vocab.js';
import { intermediateCourse } from './intermediate.js';

/**
 * All available courses
 * Order determines display order in course selection screen
 */
export const allCourses = [
    beginnerVocabCourse,
    intermediateCourse
];

/**
 * Get course by ID
 * @param {string} courseId
 * @returns {Object|null}
 */
export function getCourseById(courseId) {
    return allCourses.find(course => course.id === courseId) || null;
}

/**
 * Get all courses for a difficulty level
 * @param {string} difficulty - 'beginner', 'intermediate', 'advanced'
 * @returns {Array<Object>}
 */
export function getCoursesByDifficulty(difficulty) {
    return allCourses.filter(course => course.difficulty === difficulty);
}

/**
 * Get total number of topics across all courses
 * @returns {number}
 */
export function getTotalTopicCount() {
    let count = 0;
    allCourses.forEach(course => {
        if (course.units) {
            course.units.forEach(unit => {
                if (unit.topics) {
                    count += unit.topics.length;
                }
            });
        }
    });
    return count;
}

/**
 * Get total number of words across all courses
 * @returns {number}
 */
export function getTotalWordCount() {
    let count = 0;
    allCourses.forEach(course => {
        if (course.units) {
            course.units.forEach(unit => {
                if (unit.topics) {
                    unit.topics.forEach(topic => {
                        if (topic.words) {
                            count += topic.words.length;
                        }
                    });
                }
            });
        }
    });
    return count;
}

// Export courses individually as well
export { beginnerVocabCourse, intermediateCourse };
