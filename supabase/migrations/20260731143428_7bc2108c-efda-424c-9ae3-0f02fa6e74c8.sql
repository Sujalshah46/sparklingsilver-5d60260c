delete from order_items where order_id in (select id from orders where order_no = 'SJ26073154764');
delete from orders where order_no = 'SJ26073154764';