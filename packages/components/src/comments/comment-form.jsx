import merge from 'merge';
import { useState, useEffect, useCallback } from 'react';
import DataStore from '../data-store';
import Button from '../button';
import InputWithCounter from '../forms/input-with-counter';
import LoginButton from '../user/login-button';
import hasRole from '../lib/user-has-role';

function CommentForm(props) {

  props = merge.recursive({}, {
    descriptionMinLength: 30,
    descriptionMaxLength: 500,
    placeholder: '',
    formIntro: '',
    requiredUserRole: 'member',
  }, props.config,  props);

  const datastore = new DataStore(props);
  const [ currentUser, currentUserError, currentUserIsLoading ] = datastore.useCurrentUser({ ...props });

  function canSubmit() {
    return hasRole(currentUser, props.requiredUserRole)
  }

  let parentIdHTML = null;
  if (props.parentId) {
    parentIdHTML = <input type="hidden" defaultValue={props.parentId} name="parentId"/>
  }

  let formIntroHTML = null;
  if (props.formIntro) {
    formIntroHTML = (
      <div className="osc-intro">{props.formIntro}</div>
    );
  }

  let submitButtonHTML = <Button type="submit" disabled={!canSubmit()}>Verstuur</Button>
  if (!currentUser || currentUser.role !=  props.requiredUserRole) { // TODO: hasrole
    submitButtonHTML = <LoginButton {...props} label="Inloggen"/>
  }

  return (
    <form  onSubmit={props.submitComment}>
      {formIntroHTML}
      <input type="hidden" defaultValue={props.id} name="id"/>
      {parentIdHTML}
      <input type="hidden" defaultValue={props.sentiment} name="sentiment"/>
      <InputWithCounter inputType="textarea" minLength={props.descriptionMinLength} maxLength={props.descriptionMaxLength} placeholder={props.placeholder} defaultValue={props.description} name="description"/>
      <div className="osc-align-right-container">
        {submitButtonHTML}
      </div>
    </form>
  );

}

export default CommentForm;
