/*! Copyright 2026 Adobe
All Rights Reserved. */
import{f as a}from"./fetch-graphql.js";const n=`
  mutation SubscribeToNewsletter($email: String!) {
    subscribeEmailToNewsletter(email: $email) {
      status
    }
  }
`,l=async r=>{const i=r==null?void 0:r.trim();if(!i)throw new Error("Email is required");const{data:s,errors:t}=await a(n,{variables:{email:i}});if(t!=null&&t.length)throw new Error(t.map(o=>o.message).join(", "));const e=s==null?void 0:s.subscribeEmailToNewsletter;if(!(e!=null&&e.status))throw new Error("Newsletter subscription failed");return e};export{l as s};
//# sourceMappingURL=subscribeToNewsletter.js.map
