// src/api/deck/content-types/deck/lifecycles.ts

import { errors } from '@strapi/utils';
const { ApplicationError } = errors;

export default {
    beforeCreate(event) {
        const { data } = event.params;

        if (data.minDifficulty > data.maxDifficulty) {
            throw new ApplicationError('minDifficulty cannot exceed maxDifficulty!', {
                minDifficulty: ['minDifficulty must be less than maxDifficulty'],
                maxDifficulty: ['maxDifficulty must be greater than minDifficulty']
            });
        }
    },

    beforeUpdate(event) {
        const { data } = event.params;

        if (data.minDifficulty && data.maxDifficulty && data.minDifficulty > data.maxDifficulty) {
            throw new ApplicationError('minDifficulty cannot exceed maxDifficulty!', {
                minDifficulty: ['minDifficulty must be less than maxDifficulty'],
                maxDifficulty: ['maxDifficulty must be greater than minDifficulty']
            });
        }
    }
};
