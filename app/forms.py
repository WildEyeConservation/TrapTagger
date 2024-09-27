'''
Copyright 2023

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField, TextAreaField, HiddenField, IntegerField
from wtforms.validators import DataRequired, EqualTo, ValidationError, Email
from app.models import User, Organisation

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    password2 = PasswordField(
        'Repeat Password', validators=[DataRequired(), EqualTo('password')])
    sum_check = IntegerField('What is 3 + 4?', validators=[DataRequired()])
    submit = SubmitField('Register')

    def validate_username(self, username):
        username.data = username.data.strip()
        user = User.query.filter_by(username=username.data).first()
        folder = username.data.lower().replace(' ','-').replace('_','-')
        folder_check = Organisation.query.filter_by(folder=folder).first()
        org = Organisation.query.filter_by(name=username.data).first()
        if user is not None or folder_check is not None or org is not None:
            raise ValidationError('Please use a different username.')
        if len(username.data) > 64:
            raise ValidationError('Username must be less than 64 characters.')
        disallowed_chars = '"[@!#$%^&*()<>?/\|}{~:]' + "'"
        disallowed = any(r in disallowed_chars for r in username.data)
        if disallowed:
            raise ValidationError('Username cannot contain special characters.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).filter(~User.root_organisation.has()).first()
        if user is not None:
            raise ValidationError('Please use a different email address.')

    def validate_sum_check(self, sum_check):
        if sum_check.data != 7:
            raise ValidationError('Incorrect answer.')

class NewSurveyForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = TextAreaField('Name', validators=[DataRequired()])
    trapgroup_code = StringField('Name', validators=[DataRequired()])

class EnquiryForm(FlaskForm):
    organisation = StringField('Organisation', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    description = TextAreaField('Description', validators=[DataRequired()])
    info = HiddenField('info')
    sum_check = IntegerField('What is 3 + 4?', validators=[DataRequired()])

    def validate_sum_check(self, sum_check):
        if sum_check.data != 7:
            raise ValidationError('Incorrect answer.')

class ResetPasswordForm(FlaskForm):
    password = PasswordField('Password', validators=[DataRequired()])
    password2 = PasswordField('Repeat Password', validators=[DataRequired(), EqualTo('password')])

class RequestPasswordChangeForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    username = StringField('Username', validators=[DataRequired()])