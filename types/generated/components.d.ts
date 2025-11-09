import type { Schema, Struct } from '@strapi/strapi';

export interface ExamFaq extends Struct.ComponentSchema {
  collectionName: 'components_exam_faqs';
  info: {
    description: 'Frequently asked question and answer.';
    displayName: 'FAQ';
    icon: 'question';
  };
  attributes: {
    answer: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 1000;
        minLength: 20;
      }>;
    question: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
        minLength: 5;
      }>;
  };
}

export interface ExamMcq extends Struct.ComponentSchema {
  collectionName: 'components_exam_mcqs';
  info: {
    description: 'Multiple-choice question with four options.';
    displayName: 'MCQ';
    icon: 'check-square';
  };
  attributes: {
    correct_option: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
        minLength: 1;
      }>;
    options: Schema.Attribute.JSON & Schema.Attribute.Required;
    question: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
        minLength: 5;
      }>;
  };
}

export interface ExamSyllabusBullet extends Struct.ComponentSchema {
  collectionName: 'components_exam_syllabus_bullets';
  info: {
    description: 'Single syllabus bullet point.';
    displayName: 'Syllabus Bullet';
    icon: 'list';
  };
  attributes: {
    text: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
        minLength: 2;
      }>;
  };
}

export interface QuestionOption extends Struct.ComponentSchema {
  collectionName: 'components_question_options';
  info: {
    description: 'Single answer option for MCQ questions.';
    displayName: 'Question Option';
    icon: 'bulletList';
  };
  attributes: {
    is_correct: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    text: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 300;
        minLength: 1;
      }>;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'exam.faq': ExamFaq;
      'exam.mcq': ExamMcq;
      'exam.syllabus-bullet': ExamSyllabusBullet;
      'question.option': QuestionOption;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
    }
  }
}
